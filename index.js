const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const emailValidator = require('email-validator');
const fs = require('fs');
const uuid = require('short-uuid');
const session = require('express-session');
require('dotenv').config();

const app = express();
let productList = new Map();


const upload = multer({
    dest: 'uploads',
    fileFilter: (req, file, callback) => {
        file.mimetype.startsWith('image/') ? callback(null, true) : callback(null, false);
    },
    limits: { fileSize: 500000 }
});


app.set('view engine', 'ejs');
app.use('/uploads', express.static('uploads'));
app.use(session({ secret: 'secret_password_here' }));
app.use(bodyParser.urlencoded({ extended: true }));


const handleError = (res, message, view, data = {}) => {
    res.render(view, { ...data, errorMessage: message });
};


app.get('/', (req, res) => {
    req.session.user 
        ? res.render('index', { products: Array.from(productList.values()) })
        : res.redirect('/login');
});

app.get('/product/:id', (req, res) => {
    const product = productList.get(req.params.id);
    product ? res.render('product', { product }) : res.status(404).render('error', {
        title: 'Product Not Found', message: 'The product does not exist.'
    });
});

app.route('/edit/:id')
    .get((req, res) => {
        const product = productList.get(req.params.id);
        product ? res.render('edit', { product, error: '' }) : handleError(res, 'Product not found', 'error');
    })
    .post((req, res) => {
        const product = productList.get(req.params.id);
        if (!product) return handleError(res, 'Product not found', 'error');

        const { name, price, desc } = req.body;
        let error;
        if (!name?.trim()) error = 'Please enter a valid name';
        else if (!price || isNaN(price) || parseFloat(price) < 0) error = 'Please enter a valid price';
        else if (!desc?.trim()) error = 'Please enter a valid description';

        if (error) return res.render('edit', { product, error });

        productList.set(req.params.id, { ...product, name, price: parseFloat(price), desc });
        res.redirect('/?message=Product updated successfully');
    });

app.route('/add')
    .get((req, res) => res.render('add', { error: '', name: '', price: '', desc: '' }))
    .post(upload.single('image'), (req, res) => {
        const { name, price, desc } = req.body;
        const image = req.file;

        let error;
        if (!name) {
            error = 'Vui lòng nhập đúng tên'
        } else if (!price || isNaN(price) || parseInt(price) < 0) {
            error = 'Vui lòng nhập đúng giá' 
        } else if (!desc) {
            error = 'Nhập mô tả' 
        }
        else if (!image) {
            error = 'Thêm ảnh'
        }
        if (error) return res.render('add', { error, name, price, desc });

        const imagePath = `uploads/${image.originalname}`;
        fs.renameSync(image.path, imagePath);
        const product = { id: uuid.generate(), name, price: parseInt(price), desc, image: imagePath };
        productList.set(product.id, product);
        res.redirect('/');
    });

app.route('/login')
    .get((req, res) => req.session.user ? res.redirect('/') : res.render('login', { email: '', password: '' }))
    .post((req, res) => {
        const { email, password } = req.body;
        let error;
        if (!email) {
            error = 'Vui lòng nhập Email';
        }else if (!emailValidator.validate(email)) {
            error = 'Email sai định dạng' 
        } else if (!password) {
            error = 'Vui lòng nhập mật khẩu'
        } else if (password.length < 6) {
            error = 'Mật khẩu phải có ít nhất 6 kí tự'
        } else if (email !== process.env.EMAIL || password !== process.env.PASSWORD) {
            error = 'Sai tài khoản hoặc mật khẩu';
        }
        if (error) return res.render('login', { errorMessage: error, email, password });

        req.session.user = email;
        res.redirect('/');
    });

app.post('/delete', (req, res) => {
    const { id } = req.body;
    if (!id || !productList.has(id)) {
        res.json({ code: 1, message: 'Invalid product ID' });
    } else {
        const product = productList.get(id);
        productList.delete(id);
        res.json({ code: 0, message: 'Product deleted successfully', data: product });
    }
});

app.use((req, res) => {
    res.status(404).render('error', {
        title: '404 Not Found',
        message: 'The page you are looking for does not exist.'
    });
});


let port = process.env.PORT || 8080
app.listen(port, ()=> console.log('http://localhost:'+port))
