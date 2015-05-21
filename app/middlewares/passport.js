let util = require('util')
let LocalStrategy = require('passport-local').Strategy
let FacebookStrategy = require('passport-facebook').Strategy
let TwitterStrategy = require('passport-twitter').Strategy
let GoogleStrategy = require('passport-google-oauth2').Strategy
let passport = require('passport')
let nodeifyit = require('nodeifyit')
let config = require('../../config/auth')
let User = require('../models/user')

require('songbird')


function useExternalPassportStrategy(OauthStrategy, config, field) {
  config.passReqToCallback = true
  passport.use(new OauthStrategy(config, nodeifyit(authCB, {spread: true})))

  async function authCB(req, token, token_secret, account) {
      // 1. Load user from store
      // 2. If req.user exists, we're authorizing (connecting an account)
      // 2a. Ensure it's not associated with another account
      // 2b. Link account
      // 3. If not, we're authenticating (logging in)
      // 3a. If user exists, we're logging in via the 3rd party account
      // 3b. Otherwise create a user associated with the 3rd party account
      console.log(req.user)
      console.log(JSON.stringify(account))
      console.log(token)
      console.log(token_secret)
      //console.log(config)
      let linked_user
      switch(field){
        case 'facebook':
          linked_user = await User.promise.findOne({'facebook.id': account.id})
          break
        case 'twitter':
          linked_user = await User.promise.findOne({'twitter.id': account.id})
          break
        case 'google':
          linked_user = await User.promise.findOne({'google.id': account.id})
          break
        default:
          linked_user = await User.promise.findOne({'local.id': account.id})
      }
      
      if (req.user) {
        // Ensure not associated with another account
        if (linked_user) {
          if (req.user[field].id != linked_user[field].id){
            return [false, {message: `${field} account already associated with another local account`}]
          }
        } else {
          // link account
          let user = await User.promise.findOne({'local.email': req.user.local.email})
          user[field].id = account.id
          user[field].token = token
          user[field].token_secret = token_secret
          if (field == 'twitter'){
            user[field].displayName = account.displayName
            user[field].username = account.username
          } else {
            user[field].email = account.emails[0].value
            user[field].name = account.displayName
          }
          user.local.email = req.user.local.email
          user.local.password = req.user.local.password
          return await user.save()
        }
      } else {
          // we are logging in directly from 3rd party account
          // use 3rd party account info as local account info
          if (linked_user && account.id == linked_user[field].id) {
            // account has already linked to the 3rd party
            console.log('token secret is ....', token_secret)
            linked_user[field].token_secret = token_secret
            return await linked_user.save()
          } else {
            console.log("I am here to create....")
            let new_user = new User()
            new_user[field].id = account.id
            new_user[field].token = token
            new_user[field].token_secret = token_secret
            if (field == "twitter") {
              new_user[field].username = account.username
              new_user[field].displayName = account.displayName
            } else {
              new_user[field].email = account.emails[0].value
              new_user[field].name = account.displayName
            }
            return await new_user.save()
            
          }
      }
      return
  }
}

function configure(config) {
  // Required for session support / persistent login sessions
  passport.serializeUser(nodeifyit(async (user) => user._id))

  passport.deserializeUser(nodeifyit(async (id) => {
    return await User.promise.findById(id)
  }))

  // useExternalPassportStrategy(LinkedInStrategy, {...}, 'linkedin')
  // useExternalPassportStrategy(LinkedInStrategy, {...}, 'facebook')
  // useExternalPassportStrategy(LinkedInStrategy, {...}, 'google')
  // useExternalPassportStrategy(LinkedInStrategy, {...}, 'twitter')
  // passport.use('local-login', new LocalStrategy({...}, (req, email, password, callback) => {...}))
  // passport.use('local-signup', new LocalStrategy({...}, (req, email, password, callback) => {...}))

  useExternalPassportStrategy(FacebookStrategy, {
    clientID: config.facebook.consumerKey,
    clientSecret: config.facebook.consumerSecret,
    callbackURL: config.facebook.callbackUrl
  }, 'facebook') 

  useExternalPassportStrategy(TwitterStrategy, {
    consumerKey: config.twitter.consumerKey,
    consumerSecret: config.twitter.consumerSecret,
    callbackURL: config.twitter.callbackUrl
  }, 'twitter') 

  useExternalPassportStrategy(GoogleStrategy, {
    clientID: config.google.consumerKey,
    clientSecret: config.google.consumerSecret,
    callbackURL: config.google.callbackUrl
  }, 'google') 

  passport.use('local-login', new LocalStrategy({
      usernameField: 'email',
      failureFlash: true,
      passReqToCallback: true
  }, nodeifyit(async (req, email, password) => {
      let user = await User.promise.findOne({'local.email': email})
      console.log(user)
      if (!user) return [false, {message: 'user not found'}]
      if (email !== user.local.email) {
        return [false, {message: 'Invalid username'}]
      }

      if (!await user.validatePassword(password)) {
        return [false, {message: 'Invalid password'}]
      }
      return user
  }, {spread: true})))
  
  passport.use('local-signup', new LocalStrategy({
    usernameField: 'email',
    failureFlash: true,
    passReqToCallback: true
  }, nodeifyit(async (req, email, password) => {
      email = (email || '').toLowerCase()
      // Is the email taken?
      if (await User.promise.findOne({'local.email': email})) {
        return [false, {message: 'That email is already taken.'}]
      }
      
      let user = new User()
      user.local.email = email
      //user.password = password
      user.local.password = await user.generateHash(password)
      try {
        return await user.save()
      } catch(e) {
        console.log(util.inspect(e))
        return [false, {message: e.message}]
      }
  }, {spread: true})))

  return passport
}

module.exports = {passport, configure}