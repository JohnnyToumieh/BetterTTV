# ❄ Icicle [![Build Status](https://travis-ci.org/dfcreative/icicle.svg?branch=master)](https://travis-ci.org/dfcreative/icicle) [![Code Climate](https://codeclimate.com/github/dfcreative/icicle/badges/gpa.svg)](https://codeclimate.com/github/dfcreative/icicle) <a href="UNLICENSE"><img src="http://upload.wikimedia.org/wikipedia/commons/6/62/PD-icon.svg" width="20"/></a>

Tiny mutex.

`$ npm install icicle`

```js
var icicle = require('icicle');

var a = {};

icicle.freeze(a, 'waitABit'); // true - lock is set
icicle.freeze(a, 'waitABit'); // false - lock is already set

icicle.isFrozen(a, 'waitABit'); // true

icicle.unfreeze(a, 'waitABit'); // true - lock is unset
icicle.unfreeze(a, 'waitABit'); // false - lock isn’t set

icicle.isFrozen(a, 'waitABit'); // false
```


[![NPM](https://nodei.co/npm/icicle.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/icicle/)