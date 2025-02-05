const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('./../schemas/userModel');
const AppError = require('./../utilities/appError');
const util = require('util');


const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };
  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }
 
  res.cookie('jwt', token, cookieOptions).render('loginbase',{userauthorised:user});
  

  // Remove password from output
  user.password = undefined;


};

exports.signup = async (req, res, next) => {
 
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    phno:req.body.phno,
    dob:req.body.dob

  });

  try {
    // const newcustomer = new customer({})
    // newcustomer.save()

   
    // const newcustomer = await User.create(req.body);

    res.status(200).render('login');

  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err
    });
  }

  // createSendToken(newUser, 201, res);
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    let no_email_password='Fields cannot be left Blank';
    res.status(200).render("login",{no_email_password});
   
  }
  else{
  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

   if (!user || !(await user.correctPassword(password))) {
    let wrong_mail_password='Incorrect email or password';
    res.status(200).render("login",{wrong_mail_password});
    
  }
else{
  // 3) If everything ok, send token to client
  
  createSendToken(user, 200, res);
  authorised="true"
}
  }
};

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).render("logout");
};

exports.protect = async (req, res, next) => {

 
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
 

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }



  // 2) Verification token
  const decoded = await util.promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  req.user=currentUser;
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued

  if (!currentUser.changedPasswordAfter(decoded.iat)) {
    return next();
  } else {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
};

// Only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await util.promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        res.render('loginbase')
        return next();
      }

      // 3) Check if user changed password after the token was issued
      if (!currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      } else {
        return next(
          new AppError('User recently changed password! Please log in again.', 401)
        );
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }

  next();

};


