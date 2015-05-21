// config/auth.js
module.exports = {
  'development': {
    'facebook': {
      'consumerKey': '1446587062318536',
      'consumerSecret': '27c8e1ec148e4c05b6d06872ab1d2e78',
      'callbackUrl': 'http://socialfeed.com:8000/auth/facebook/callback'
    },
    'twitter': {
      'consumerKey': 'q1hZcbypfhxemH4sMuvtIlEOl',
      'consumerSecret': 'SamR3vor7iq5NxiHaxCwrmRd0WJ5fglwtPh8UgL1G2USUAlMNa',
      'callbackUrl': 'http://socialfeed.com:8000/auth/twitter/callback'
    },
    'google': {
      'consumerKey': '531935275296-07m0agt4gkke1oj2o2agc3gmfq88eq0k.apps.googleusercontent.com',
      'consumerSecret': 'ZEVofHtX-wSvyKKCDYJc7pvX',
      'callbackUrl': 'http://socialfeed.com:8000/auth/google/callback'
    }
  }
}
