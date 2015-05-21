let mongoose = require('mongoose')
let bcrypt = require('bcrypt')
let nodeify = require('bluebird-nodeify')

let UserSchema = mongoose.Schema({
	local: {
		/*
		email: {
			type: String,
			required: true
		},
		password: {
			type: String,
			required: true
		}
		*/
		email: String,
		password: String
	},
	facebook: {
   		id: String,
   		token: String,
   		token_secret: String,
   		email: String,
   		name: String
	},
	twitter: {
		id: String,
		token: String,
		token_secret: String,
		displayName: String,
		username: String
	},
	google: {
		id: String,
		token: String,
		token_secret: String,
		email: String,
		name: String
	}
})

UserSchema.methods.generateHash = async function(password) {
  return await bcrypt.promise.hash(password, 8)
}

UserSchema.methods.validatePassword = async function(password) {
  return await bcrypt.promise.compare(password, this.local.password)
}

UserSchema.pre('save', function(callback){
	nodeify(async() => {
		if(!this.isModified('password')) return callback()
		this.password = await this.generateHash(this.password)
	}(), callback)
})

UserSchema.path('local.password').validate((pw) => {
  return pw.length >= 4 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) &&
  	/[0-9]/.test(pw)
})

module.exports = mongoose.model('User', UserSchema)