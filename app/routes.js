let _ = require('lodash')
let then = require('express-then')
let Twitter = require('twitter')
let FB = require('fb')
let Google = require('googleapis')
let isLoggedIn = require('./middlewares/isLoggedIn')
//let posts = require('../data/posts')

let networks = {
    twitter: {
        icon: 'twitter',
        name: 'Twitter',
        class: 'btn-primary'
    },
    facebook: {
        icon: 'facebook',
        name: 'Facebook',
        class: 'btn-primary'
    },
    google: {
        icon: 'google',
        name: 'Google',
        class: 'btn-primary'
    }
}

module.exports = (app) => {
	let passport = app.passport
    let scopes = {
        'facebook': ['email'],
        'google': ['email', 'profile'],
        'twitter': ['email'] 
    }
    let twitterConfig = app.config.auth.twitter
    let facebookConfig = app.config.auth.facebook
    let googleConfig = app.config.auth.google
    
    app.get('/', (req, res) => res.render('index.ejs'))

    app.get('/profile', isLoggedIn, (req, res) => {
        res.render('profile.ejs', {
            user: req.user,
            message: req.flash('error')
        })
    })

    app.get('/logout', (req, res) => {
        req.logout()
        res.redirect('/')
    })

    app.get('/login', (req, res) => {
        res.render('login.ejs', {message: req.flash('error')})
    })

    app.get('/signup', (req, res) => {
    	res.render('signup.ejs', {message: req.flash('error')})
  	})

    app.post('/login', passport.authenticate('local-login', {
        successRedirect: '/profile',
        failureRedirect: '/login',
        failureFlash: true
    }))
  	
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect: '/profile',
    	failureRedirect: '/signup',
    	failureFlash: true
    }))
    // Your routes here... e.g., app.get('*', handler)
    // Facebook Authentication route & Callback URL
    app.get('/auth/facebook', passport.authenticate('facebook', 
        {scope: ['email', 'publish_actions', 'user_posts', 'user_likes', 'read_stream']}))
    app.get('/auth/facebook/callback', passport.authenticate('facebook', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Facebook Authorization route & Callback URL
    app.get('/connect/facebook', passport.authorize('facebook', 
        {scope: ['email', 'publish_actions', 'user_posts', 'user_likes', 'read_stream']}))
    app.get('/connect/facebook/callback', passport.authorize('facebook', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Twitter Authentication route & Callback URL
    app.get('/auth/twitter', passport.authenticate('twitter', {scope: ['email']}))
    app.get('/auth/twitter/callback', passport.authenticate('twitter', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Twitter Authorization route & Callback URL
    app.get('/connect/twitter', passport.authorize('twitter', {scope: ['email']}))
    app.get('/connect/twitter/callback', passport.authorize('twitter', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Google Authentication route & Callback URL
    app.get('/auth/google', passport.authenticate('google', {scope: ['email', 'profile']}))
    app.get('/auth/google/callback', passport.authenticate('google', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    // Google Authorization route & Callback URL
    app.get('/connect/google', passport.authorize('google', {scope: ['email', 'profile']}))
    app.get('/connect/google/callback', passport.authorize('google', {
        successRedirect: '/profile',
        failureRedirect: '/profile',
        failureFlash: true
    }))

    app.get('/unlink/:type', isLoggedIn, then(async (req, res, next)=> {
        let validTypes = Object.keys(scopes).concat(['local'])
        if (!_.contains(validTypes, req.params.type)) return next()

        await req.user.unlinkAccount(req.params.type)
        let stillLoggedIn = _.any(validTypes, type => {
            if (type === 'local') return req.user[type].email
            return req.user[type] && req.user[type].id
        })
        // Stayed logged in if they still ahve linked accounts
        if (stillLoggedIn) {
            return res.redirect('/profile')
        }
        await req.user.remove()
        req.logout()
        res.redirect('/')
    }))

    app.get('/timeline', isLoggedIn, then(async (req, res)=> {
        console.log(req.user)
        try {
            let twitterClient,
                tweets,
                posts
            if (req.user.twitter.token && req.user.twitter.token_secret) {
                twitterClient = new Twitter ({
                    'consumer_key': twitterConfig.consumerKey,
                    'consumer_secret': twitterConfig.consumerSecret,
                    'access_token_key': req.user.twitter.token,
                    'access_token_secret': req.user.twitter.token_secret
                })
            }
            
            if (twitterClient) {
                [tweets] = await twitterClient.promise.get('statuses/home_timeline.json')
                tweets = tweets.map(tweet => {
                    return {
                        id: tweet.id_str,
                        image: tweet.user.profile_image_url,
                        text: tweet.text,
                        name: tweet.user.name,
                        username: '@' + tweet.user.screen_name,
                        liked: tweet.favorited,
                        timestamp: tweet.created_at,
                        network: networks.twitter
                    }
                })
            }

            if (req.user.facebook.token) {
                FB.setAccessToken(req.user.facebook.token)
                let response = await new Promise(resolve => FB.api('/me/home', resolve))
                posts = response.data
                //console.log('response is ', posts)
                //console.log('...............')
                //console.log(data[0].likes)
                posts = posts.map(post=> {
                    return {
                        id: post.id,
                        image: post.picture,
                        text: post.message,
                        name: '@' + post.from.name,
                        liked: post.likes,
                        timestamp: post.updated_time,
                        network: networks.facebook
                    }
                })
            }
            // sort the aggregate posts by timestamp
            let date_sort_desc = (post1, post2) => {
                if (new Date(post1.timestamp) > new Date(post2.timestamp)) return -1;
                return 1
            }
            let sortedPosts = tweets.concat(posts).sort(date_sort_desc)

            // combined posts across social networks
            res.render('timeline.ejs', {
                posts: sortedPosts
            })
        } catch(e) {
            console.log(e)
        }
    }))

    app.get('/reply/Twitter/:id', isLoggedIn, then(async (req, res) => {
        let id = req.params.id
        let twitterClient = new Twitter ({
                'consumer_key': twitterConfig.consumerKey,
                'consumer_secret': twitterConfig.consumerSecret,
                'access_token_key': req.user.twitter.token,
                'access_token_secret': req.user.twitter.token_secret
        })
        let [tweet] = await twitterClient.promise.get('statuses/show', {id})
        
        tweet = {
            id: tweet.id_str,
            image: tweet.user.profile_image_url,
            text: tweet.text,
            name: tweet.user.name,
            username: '@' + tweet.user.screen_name,
            liked: tweet.favorited,
            network: networks.twitter
        }
        res.render('reply.ejs', {
            post: tweet
        })
    }))

    app.get('/reply/Facebook/:id', isLoggedIn, then(async (req, res) => {
        let id = req.params.id
        
        FB.setAccessToken(req.user.facebook.token)
        let post = await new Promise(resolve => FB.api(`/${id}`, resolve))
            
        post = {
            id: post.id,
            text: post.message,
            name: '@' + post.from.name,
            username: post.from.name,
            network: networks.facebook
        }
        
        res.render('reply.ejs', {
            post: post
        })
    }))

    app.get('/share/Twitter/:id', isLoggedIn, then(async (req, res) => {
        let id = req.params.id
        let twitterClient = new Twitter ({
            'consumer_key': twitterConfig.consumerKey,
            'consumer_secret': twitterConfig.consumerSecret,
            'access_token_key': req.user.twitter.token,
            'access_token_secret': req.user.twitter.token_secret
        })
        let [tweet] = await twitterClient.promise.get('statuses/show', {id})
        
        tweet = {
            id: tweet.id_str,
            image: tweet.user.profile_image_url,
            text: tweet.text,
            name: tweet.user.name,
            username: '@' + tweet.user.screen_name,
            liked: tweet.favorited,
            network: networks.twitter
        }
        res.render('share.ejs', {
            post: tweet
        })
    }))

    app.get('/share/Facebook/:id', isLoggedIn, then(async (req, res) => {
        let id = req.params.id
        
        FB.setAccessToken(req.user.facebook.token)
        let post = await new Promise(resolve => FB.api(`/${id}`, resolve))
            
        post = {
            id: post.id,
            text: post.message,
            name: '@' + post.from.name,
            username: post.from.name,
            network: networks.facebook
        }
        
        res.render('share.ejs', {
            post: post
        })
    }))

    app.get('/compose', isLoggedIn, then(async (req, res) => {
        res.render('compose.ejs', {
            message: req.flash('error')
        })
    }))

    app.post('/compose', isLoggedIn, then(async (req, res) => {
        console.log("twitter button is ", req.body.hasOwnProperty('twitter'))
        console.log("facebook button is ", req.body.hasOwnProperty('facebook'))
        let status = req.body.text
        if (!status){
            return req.flash('error', 'Status cannot be empty!')
        }
        if (req.body.hasOwnProperty('twitter')) {
            // twitter button is clicked
            let twitterClient = new Twitter ({
                'consumer_key': twitterConfig.consumerKey,
                'consumer_secret': twitterConfig.consumerSecret,
                'access_token_key': req.user.twitter.token,
                'access_token_secret': req.user.twitter.token_secret
            })
            let status = req.body.text
            if (status.length > 140){
                return req.flash('error', 'Status is over 140 characters!')
            }

            await twitterClient.promise.post('statuses/update', {status})
        } else {
            if (req.user.facebook.token) {
                FB.setAccessToken(req.user.facebook.token)
                await new Promise(resolve => FB.api('me/feed', 'post', 
                {message: status }, resolve))
            }         
        }
        res.redirect('/timeline')
    }))

    app.post('/like/Twitter/:id', isLoggedIn, then(async (req, res) => {
        let id = req.params.id
        
        let twitterClient = new Twitter ({
            'consumer_key': twitterConfig.consumerKey,
            'consumer_secret': twitterConfig.consumerSecret,
            'access_token_key': req.user.twitter.token,
            'access_token_secret': req.user.twitter.token_secret
        })
        await twitterClient.promise.post('favorites/create', {id})
        res.end()
    }))

    app.post('/like/Facebook/:id', isLoggedIn, then(async (req, res) => {
        let id = req.params.id
        
        if (req.user.facebook.token) {
            FB.setAccessToken(req.user.facebook.token)
            await new Promise(resolve => FB.api(`${id}/likes`, 'post', 
                {access_token: req.user.facebook.token}, resolve))
        }
        res.end()
    }))

    app.post('/unlike/Twitter/:id', isLoggedIn, then(async (req, res) => {
        let twitterClient = new Twitter ({
            'consumer_key': twitterConfig.consumerKey,
            'consumer_secret': twitterConfig.consumerSecret,
            'access_token_key': req.user.twitter.token,
            'access_token_secret': req.user.twitter.token_secret
        })
        let id = req.params.id
        await twitterClient.promise.post('favorites/destroy', {id})
        res.end()
    }))

    app.post('/unlike/Facebook/:id', isLoggedIn, then(async (req, res) => {
        let id = req.params.id
        
        if (req.user.facebook.token) {
            FB.setAccessToken(req.user.facebook.token)
            await new Promise(resolve => FB.api(`${id}/likes`, 'delete',
                {access_token: req.user.facebook.token}, resolve))
        }
        res.end()
    }))

    app.post('/share/Twitter/:id', isLoggedIn, then(async (req, res) => {
        let twitterClient = new Twitter ({
            'consumer_key': twitterConfig.consumerKey,
            'consumer_secret': twitterConfig.consumerSecret,
            'access_token_key': req.user.twitter.token,
            'access_token_secret': req.user.twitter.token_secret
        })
        let id = req.params.id
        let text = req.body.share
        if (text.length > 140) {
            return req.flash('error', 'status is over 140 chars')
        }
        if (!text) {
            return req.flash('error', 'status is empty')
        }
        await twitterClient.promise.post('statuses/retweet/' + id, {text})
        res.redirect('/timeline')
    }))

    app.post('/share/Facebook/:id', isLoggedIn, then(async (req, res) => {
        let id = req.params.id
        let text = req.body.share
        if (!text){
            return req.flash('error', 'status is empty')
        }
        if (req.user.facebook.token) {
            FB.setAccessToken(req.user.facebook.token)
            let post = await new Promise(resolve => FB.api(`/${id}`, resolve))
            await new Promise(resolve => FB.api('me/feed', 'post',
                {message: text, link: post.link}, resolve))
        }
        res.redirect('/timeline')
    }))

    app.post('/reply/Twitter/:id', isLoggedIn, then(async (req, res) => {
        let twitterClient = new Twitter ({
            'consumer_key': twitterConfig.consumerKey,
            'consumer_secret': twitterConfig.consumerSecret,
            'access_token_key': req.user.twitter.token,
            'access_token_secret': req.user.twitter.token_secret
        })
        let id = req.params.id
        let status = req.body.reply
        if (status.length > 140) {
            return req.flash('error', 'status is over 140 chars')
        }
        if (!status) {
            return req.flash('error', 'status is empty')
        }
        await twitterClient.promise.post('statuses/update/', {status})
        res.redirect('/timeline')
    }))

    app.post('/reply/Facebook/:id', isLoggedIn, then(async (req, res) => {
        let id = req.params.id
        let message = req.body.reply
        if (!message) {
            return req.flash('error', 'reply is empty')
        }
        if (req.user.facebook.token) {
            FB.setAccessToken(req.user.facebook.token)
            await new Promise(resolve => FB.api(`/${id}/comments`, 'post',
                {message}, resolve))
        }
        res.redirect('/timeline')
    }))

    return passport
}