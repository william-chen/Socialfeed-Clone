module.exports = function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next()
  if (!req.user) return next()
  res.redirect('/')
}
