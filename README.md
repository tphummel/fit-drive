# fit drive

A service to download your files from [fitbit](https://fitbit.com) and put them in [google drive](https://drive.google.com).

[![Build Status](https://travis-ci.com/tphummel/fit-drive.png)](https://travis-ci.com/tphummel/fit-drive) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

# install

```
npm install
```

# test

```
npm test
```

# usage

```
DB_MODE=fs FITBIT_OAUTH_CLIENT_SECRET= FITBIT_OAUTH_CLIENT_ID= DRIVE_OAUTH_CLIENT_ID=".apps.googleusercontent.com" DRIVE_OAUTH_CLIENT_SECRET="" LOGIN_JWT_SECRET= SESSION_JWT_SECRET= node index
```
