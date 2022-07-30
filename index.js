// import dependencies
const express = require('express');
const path = require('path');
var cmsApp = express();
const session = require('express-session');
const fileUpload = require('express-fileupload');

//Setup DB Connection
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/cmsProject', {
    UseNewUrlParser: true,
    UseUnifiedTopology: true
});

//Setup admin model
const Admin = mongoose.model('Admin', {
    username: String,
    password: String
})

//set up post model
const Post = mongoose.model('Post', {
    title: String,
    slug: String,
    imageName: String,
    content: String,
    lastModified: String
});

//Setup Session
cmsApp.use(session({
    secret: "thisisrandomkey123supersecret",
    resave: false,
    saveUninitialized: true
}))

//Create Object Destructuring for Express Validator
const { check, validationResult } = require('express-validator');
cmsApp.use(express.urlencoded({
    extended: true
}));

// Set path to public and views folder.
cmsApp.set('views', path.join(__dirname, 'views'));
cmsApp.use(express.static(__dirname + '/public'));
cmsApp.set('view engine', 'ejs');

// WYSIWYG Editor path setup
cmsApp.use('/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));

//file-upload
cmsApp.use(fileUpload());

// constants
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const IMG_EXTENSIONS = ['.png','.jpg','.jpeg'];
//------------------- Validation Functions --------------------
var postSlugRegex = /^[a-z]+[a-z\-]+[a-z]$/;

//function to check a value using regular expression
function checkRegex(userInput, regex)
{
    if(regex.test(userInput)) 
    {
        return true;
    }
    else 
    {
        return false;
    }
}

// Custom slug validation function
function customSlugValidation(value)
{
    if(!checkRegex(value, postSlugRegex)) 
    {
        throw new Error('Post Slug should contain only alphabets and hyphens');
    }
    return true;
}
// Custom image validation function
function customImageValidation(value, {req})
{
    if(!req.files)
    {
        throw new Error('Please upload post image');
    }
    var imageExtension = path.extname(req.files.image.name);
    if(!IMG_EXTENSIONS.includes(imageExtension))
    {
        throw new Error('Please upload image in only .png, .jpeg or .jpg format');
    }
    return true;
}


function getFormattedDate() 
{
    var dt = new Date();
    var day = ("0" + dt.getDate()).slice(-2);
    var month = MONTHS[dt.getMonth()];
    var year = dt.getFullYear();
    var dateTime = `${day} ${month}, ${year}`;
    return dateTime;
}

//------------------- Set up different routes (pages) --------------------

// Set up Routes 
cmsApp.get('/', function(req, res) {
    if (req.session.userLoggedIn) 
    {
        res.redirect('/home');
    } 
    else 
    {
        res.redirect('/login');
    }
});

//Login
cmsApp.get('/login', function(req, res) {
    res.render('login'); 
});

cmsApp.post('/login', function(req, res) {
    var user = req.body.username;
    var pass = req.body.password;
    Admin.findOne({
        username: user,
        password: pass
    }).exec(function(err, admin) {
        if (admin) 
        {
            req.session.username = admin.username;
            req.session.userLoggedIn = true;
            res.redirect('/home');
        } 
        else 
        {
            res.render('login', {
                error: "Sorry Login Failed. Please try again!"
            });
        }
    });
});

//Home
cmsApp.get('/home', function(req, res) {
    if (req.session.userLoggedIn) 
    {
        Post.find({}).exec(function(err, posts) {
            if (err) 
            {
                console.log('Error: ' + err);
            }
            res.render('home', {
                posts: posts,
                page: "home"
            });
        }); 
    }
    else 
    {
        res.redirect('/login');
    }
});

// Add Post
cmsApp.get('/add', function (req, res) {
    if (req.session.userLoggedIn) 
    {
        Post.find({}).exec(function(err, posts) {
            if (err) 
            {
                console.log('Error: ' + err);
            }
            res.render('add', {
                posts: posts,
                page: "add"
            });
        }); 
    } 
    else 
    {
      res.redirect('/login');
    }
});

cmsApp.post('/add', [
    check('title', 'Please enter post title').notEmpty(),
    check('slug', 'Please enter post slug').notEmpty().custom(customSlugValidation),
    check('image').custom(customImageValidation),
    check('content', 'Please enter main content').notEmpty()
], function(req, res) {
    if (req.session.userLoggedIn) 
    {
        const errors = validationResult(req);
        if (!errors.isEmpty()) 
        {
            console.log(errors);
            Post.find({}).exec(function(err, posts) {
                if (err) 
                {
                    console.log('Error: ' + err);
                }
                res.render('add', {
                    posts: posts,
                    errors: errors.mapped(),
                    page: "add"
                });
            }); 
        } 
        else
        {
            var title = req.body.title;
            var slug = req.body.slug;
            var content = req.body.content;
            var lastModified = getFormattedDate();
            var imageFile = req.files.image;
            var imageName = imageFile.name;
            var imagePath = 'public/post-images/' + imageName;
            imageFile.mv(imagePath, (err) =>{
                if(err) 
                {
                    res.send(err);
                }
                else 
                {
                    var newPost = new Post({
                        title: title,
                        slug: slug,
                        content: content,
                        imageName: imageName,
                        lastModified : lastModified
                    });
                    newPost.save();
                    Post.find({}).exec(function(err, posts) {
                        res.render('notificationmsg', {
                            posts: posts,
                            message: 'Post created successfully!'
                        });
                    });
                }
            });
        }
    } 
    else 
    {
        res.redirect('/login');
    }
});

// All Posts
cmsApp.get('/postlist', function(req, res) {
    if (req.session.userLoggedIn) 
    {
        Post.find({}).exec(function(err, posts) {
            if (err) 
            {
                console.log('Error: ' + err);
            }
            res.render('postlist', {
                posts: posts,
                page: "posts"
            });
        });
    } 
    else 
    {
        res.redirect('/login');
    }
});

//View Post
cmsApp.get('/view/:slug/:id', function (req, res) {
    if (req.session.userLoggedIn) 
    {
        var id = req.params.id;
        Post.findOne({
            _id: id
        }).exec(function(err, post) {
            if (post) 
            {
                res.render('post', {
                    post: post,
                    page: "posts"
                });
            } 
            else 
            {
                res.render('notificationmsg', {
                    err: 'No post found with this ID!'
                });
            }
        });
    } 
    else 
    {
        res.redirect('/login');
    }
});

//Delete Post
cmsApp.get('/delete/:slug/:id', (req, res) => {
    if (req.session.userLoggedIn) 
    {
        var id = req.params.id;
        Post.findByIdAndDelete({
            _id: id
        }).exec(function(err, post) {
            if (post) 
            {
                res.render('notificationmsg', {
                    message: 'Post deleted successfully!'
                });
            } 
            else 
            {
                res.render('notificationmsg', {
                    err: "Sorry, Post could not be deleted!"
                });
            }
        });
    } 
    else 
    {
        res.redirect('/login');
    }
});

//Edit Post
cmsApp.get('/edit/:slug/:id', (req, res) => {
    if (req.session.userLoggedIn) 
    {
        var id = req.params.id;
        Post.findOne({
            _id: id
        }).exec(function(err, post) {
            if (post) 
            {
                res.render('edit', {
                    post: post,
                });
            } 
            else 
            {
                res.render('notificationmsg', {
                    err: 'No post found with this ID!'
                });
            }
        });
    } 
    else 
    {
        res.redirect('/login');
    }
});

cmsApp.post('/edit/:slug/:id', [
    check('title', 'Post title cannot be empty').notEmpty(),
    check('slug', 'Post slug cannot be empty').notEmpty().custom(customSlugValidation),
    check('content', 'Content cannot be empty').notEmpty()
], function(req, res) {
    if (req.session.userLoggedIn)
    {
        const errors = validationResult(req);
        if (!errors.isEmpty()) 
        {
            var id = req.params.id;
            Post.findOne({
                _id: id
            }).exec(function(err, post) {
                if (post) 
                {
                    res.render('edit', {
                        post: post,
                        errors:errors.mapped()
                    });
                } 
                else 
                {
                    res.render('notificationmsg', {
                        err: 'No post found with this ID!'
                    });
                }
            });
        } 
        else 
        {
            var title = req.body.title;
            var slug = req.body.slug;
            var content = req.body.content;
            var lastModified = getFormattedDate();
            if(req.files)
            {
                var imageFile = req.files.image;
                var imageName = imageFile.name;
                var imagePath = 'public/post-images/' + imageName;
                imageFile.mv(imagePath, function(err) {
                    if (err) 
                    {
                        console.log('Error' + err);
                    }
                    else
                    {
                        var id = req.params.id;
                        Post.findOne({
                            _id: id
                        }).exec(function(err, post) {
                            post.title = title;
                            post.slug = slug;
                            post.imageName = imageName;
                            post.content = content;
                            post.lastModified = lastModified;
                            post.save();
                            res.render('notificationmsg', {
                                message: 'Post updated successfully!'
                            });
                        });
                    }
                }); 
            }
            else 
            {
                var id = req.params.id;
                Post.findOne({
                    _id: id
                }).exec(function(err, post) {
                    post.title = title;
                    post.slug = slug;
                    post.content = content;
                    post.lastModified = lastModified;
                    post.save();
                    res.render('notificationmsg', {
                        message: 'Post updated successfully!'
                    });
                });
            }
        } 
    }
    else 
    {
        res.redirect('/login');
    }
});

//Logout
cmsApp.get('/logout', (req, res) => {
    req.session.username = '';
    req.session.userLoggedIn = false;
    res.redirect('/login');
})
cmsApp.listen(5000);
console.log('Everything executed fine... Open http://localhost:5000');