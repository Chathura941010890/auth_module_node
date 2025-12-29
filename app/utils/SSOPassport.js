const passport = require('passport');
const MicrosoftStrategy = require('passport-microsoft').Strategy;

passport.use(new MicrosoftStrategy({
    clientID: process.env.AZURE_AD_CLIENT_ID,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    callbackURL: '/auth/api/v1/ssoCallback',
    scope: ['user.read']
  },
  async (accessToken, refreshToken, profile, done) => {
     return done(null, profile);
  }
));

module.exports = passport;