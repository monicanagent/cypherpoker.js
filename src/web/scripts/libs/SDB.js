(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":1,"ieee754":3,"isarray":4}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],5:[function(require,module,exports){
(function (Buffer){
'use strict';

/**
* @file Services Descriptor Bundle encoding and decoding library.
*
* @version 0.2.0
* @author Patrick Bay (Monican Agent)
* @copyright MIT License
*/

/**
* @class  Handles encoding and decoding of Services Descriptor Bundle data to / from
* various formats.
*
* @see  Ascii85/Base85 encoding and decoding adapted from ascii85.js by Yuri Konotopov -
* <a href="https://github.com/nE0sIghT/ascii85.js">https://github.com/nE0sIghT/ascii85.js</a>
*/
class SDB {

   /**
   * Creates a new SDB instance.
   */
   constructor() {
   }

   /**
   * @property {Number} version=0 The SDB header / data format version
   * used with coded binary data.
   */
   static get version() {
      return (1);
   }

   /**
   * Validates a version 0 SDB entity object to ensure that there are no
   * invalid or missing data properties.
   *
   * @param {Object} entityObj The entity object to validate.
   *
   * @return {null|String} A <code>null</code> is returned if all validation
   * passed, otherwise a string is returned describing the validation failure.
   *
   * @static
   */
   static validateEntityObject (entityObj) {
      if (typeof(entityObj) != "object") {
         return ("Entity must be an object.");
      }
      if (entityObj.entity == undefined) {
         return ("\"entity\" property is required.");
      }
      if (typeof(entityObj.entity) != "string") {
         return ("\"entity\" property must be a string.");
      }
      for (var dataType in entityObj) {
         switch (dataType) {
            case "entity":
               var entType = entityObj[dataType];
               if ((entType != "api") && (entType != "p2p") && (entType != "peer")) {
                  return ("\""+entType+"\" is not a recognized entity type.");
               }
               break;
            case "name":
               if (typeof(entityObj[dataType]) != "string") {
                  return ("\"name\" property must be a string.");
               }
               break;
            case "description":
               if (typeof(entityObj[dataType]) != "string") {
                  return ("\"description\" property must be a string.");
               }
               break;
            case "transport":
               switch (entityObj[dataType]) {
                  case "http": break;
                  case "wss": break;
                  case "wsst": break;
                  case "webrtc": break;
                  default:
                     return ("\""+entityObj[dataType]+"\" is not a recognized transport.");
                     break;
               }
               break;
            case "protocol":
               switch (entityObj[dataType]) {
                  case "http": break;
                  case "https": break;
                  case "ws": break;
                  case "wss": break;
                  default:
                     return ("\""+entityObj[dataType]+"\" is not a recognized protocol.");
                     break;
               }
               break;
            case "host":
               if (typeof(entityObj[dataType]) != "string") {
                  return ("\"host\" property must be a string.");
               }
               break;
            case "port":
               if (typeof(entityObj[dataType]) != "number") {
                  return ("\"port\" must be a number.");
               }
               break;
            case "parameters":
               if (typeof(entityObj[dataType]) != "string") {
                  return ("\"parameters\" property must be a string.");
               }
               break;
         }
      }
      return (null); // everything looks okay
   }

   /**
   * @property {Array} data=null The native JavaScript indexed array containing
   * the SDB associated with this instance.
   *
   * @readonly
   */
   get data() {
      if (this._data == undefined) {
         this._data = null;
      }
      return (this._data);
   }

   /**
   * @property {Buffer} bin=null The native binary Buffer containing the SDB
   * associated with this instance.
   *
   * @readonly
   */
   get bin() {
      if (this._bin == undefined) {
         this._bin = null;
      }
      return (this._bin);
   }

   /**
   * Encodes the native SDB [data]{@link SDB@data} object to a compressed
   * base85 or base64 string. The processed binary data is also set to the
   * [bin]{@link SDB@bin} Buffer.
   *
   * @param {String} [encoding="base85"] The desired data encoding to use,
   * either "base85" or "base64".
   * @param {Function} [processPipe=null] An optional processing function
   * to be applied to the SDB binary Buffer before applying the <code>encoding</code>.
   * If the referenced function is asynchronous (it returns a <code>Promise</code>),
   * then This function will also return a <code>Promise</code> that will
   * resolve when the <code>processPipe</code> has resolved, otherwise
   * this function will be trated as a synchronous inline function.
   *
   * @return {Promise} An asynchronous promise is returned that resolves withthe
   * SDB [data]{@link SDB@data} in the desired encoding.
   *
   */
   encode(encoding="base85", processPipe=null) {
      if (this.data == null) {
         throw (new Error("No SDB to encode."));
      }
      var entitiesBuff = Buffer.alloc(0);
      var historyArr = new Array();
      for (var count=0; count < this.data.length; count++) {
         var entityData = this.data[count];
         if (typeof(entityData.entity) != "string") {
            throw (new Error ("Missing or wrong type \"+entity+\" property."));
         }
         var encodedEntity = this.encodeEntity(entityData, count, historyArr);
         var newLength = entitiesBuff.length + encodedEntity.length;
         entitiesBuff = Buffer.concat([entitiesBuff, encodedEntity], newLength);
      }
      //prepend version
      var versionBuff = Buffer.from([SDB.version]);
      newLength = entitiesBuff.length + 1;
      entitiesBuff = Buffer.concat([versionBuff, entitiesBuff], newLength);
      this._bin = entitiesBuff;
      var promise = new Promise((resolve, reject) => {
         if (processPipe != null) {
            var result = processPipe(entitiesBuff);
            if (result instanceof Promise) {
               result.then(entitiesBuff => {
                  if ((encoding == "base85") || (encoding == "ascii85")) {
                     var returnStr = this.bufferToBase85(entitiesBuff);
                  } else if (encoding == "base64") {
                     returnStr = entitiesBuff.toString(encoding);
                  } else if (encoding == "none") {
                     returnStr = null;
                  }
                  resolve(returnStr);
               })
            } else {
               if ((encoding == "base85") || (encoding == "ascii85")) {
                  var returnStr = this.bufferToBase85(entitiesBuff);
               } else if (encoding == "base64") {
                  returnStr = entitiesBuff.toString(encoding);
               } else if (encoding == "none") {
                  returnStr = null;
               }
               resolve(returnStr);
            }
         } else {
            if ((encoding == "base85") || (encoding == "ascii85")) {
               var returnStr = this.bufferToBase85(entitiesBuff);
            } else if (encoding == "base64") {
               returnStr = entitiesBuff.toString(encoding);
            } else if (encoding == "none") {
               returnStr = null;
            }
            resolve(returnStr);
         }
      });
      return (promise);
   }

   /**
   * Decodes the supplied SDB data and assigns it to the [data]{@link SDB@data}
   * and [bin]{@link SDB@bin} properties if successful.
   *
   * @param {String|Array|Buffer} SDBData The data to decode. If this is a string,
   * it is decoded using either the detected encoding method or the one specified
   * by the <code>encoding</code> parameter. If this is an array it's assumed to
   * be a native object and assigned to [data]{@link SDB@data} and [data]{@link SDB@data}.
   * If this is a Buffer, it's assigned directly to the [data]{@link SDB@data} and
   * decoded to [data]{@link SDB@data}.
   * @param {String} [encoding=null] The string encoding used for <code>SDBData</code>
   * if it's a string. If <code>SDBData</code> is not a string this parameter is ignored.
   * If <code>processPipe</code> was supplied and was asynchronous (it returned a
   * <code>Promise</code>) then a <code>Promise</code> will also be returned here and
   * resolved when the <code>processPipe</code> resolves.
   * @param {Function} [processPipe=null] An optional processing function
   * to be applied to the decoded but unparsed SDB binary Buffer before applying
   * the <code>decoding</code>.
   *
   * @return {Promise} An asynchronous promise is returned that resolves when the
   * decoding process has completed.
   */
   decode(SDBData, encoding=null, processPipe=null) {
      if (SDBData instanceof Array) {
         //no need to parse this
         this._data = SDBData;
         var promise = new Promise((resolve, reject) => {
            this.encode("none").then(result => {
               if (processPipe != null) {
                  if (processPipe instanceof Promise) {
                     processPipe(this.bin).then(result => {
                        resolve (this.bin);
                     })
                  } else {
                     result = processPipe(this.bin);
                     resolve (this.bin);
                  }
               } else {
                  resolve (this.bin);
               }
            });
         });
         return (promise);
      } else if (SDBData instanceof Buffer) {
         //already native
         var decodeBuff = SDBData;
      } else if (typeof(SDBData) == "string") {
         //either Base85 or Base64
         SDBData = SDBData.trim();
         if ((SDBData.indexOf("<~") > -1) || (encoding == "base85") || (encoding == "ascii85")) {
            decodeBuff = this.base85ToBuffer(SDBData);
         } else {
            decodeBuff = Buffer.from(SDBData, "base64");
         }
      } else {
         throw (new Error("Data type not recognized."));
      }
      var promise = new Promise((resolve, reject) => {
         if (processPipe != null) {
            var response = processPipe(decodeBuff);
            if (response instanceof Promise) {
               response.then(decodeBuff => {
                  var sdbVersion = decodeBuff.readUInt8(0);
                  if (sdbVersion != SDB.version) {
                     //future revisions may need more comlex checks
                     throw (new Error("SDB verion "+sdbVersion+ " does not match supported version "+SDB.version));
                  }
                  this._data = new Array();
                  var historyArr = new Array();
                  var entityIndex = 0;
                  var offset = 1;
                  while (offset < decodeBuff.length) {
                     try {
                        var entityObj = this.readEntity(decodeBuff, offset);
                        offset = entityObj.nextOffset;
                        this._data.push(this.decodeEntity(entityObj, entityIndex, historyArr));
                        entityIndex++;
                     } catch (err) {
                        offset = decodeBuff.length + 1;
                     }
                  }
               });
               resolve(true);
            } else {
               var sdbVersion = decodeBuff.readUInt8(0);
               if (sdbVersion != SDB.version) {
                  //future revisions may need more comlex checks
                  throw (new Error("SDB verion "+sdbVersion+ " does not match supported version "+SDB.version));
               }
               this._data = new Array();
               var historyArr = new Array();
               var entityIndex = 0;
               var offset = 1;
               while (offset < decodeBuff.length) {
                  try {
                     var entityObj = this.readEntity(decodeBuff, offset);
                     offset = entityObj.nextOffset;
                     this._data.push(this.decodeEntity(entityObj, entityIndex, historyArr));
                     entityIndex++;
                  } catch (err) {
                     offset = decodeBuff.length + 1;
                  }
               }
               resolve(true);
            }
         } else {
            var sdbVersion = decodeBuff.readUInt8(0);
            if (sdbVersion != SDB.version) {
               //future revisions may need more comlex checks
               throw (new Error("SDB verion "+sdbVersion+ " does not match supported version "+SDB.version));
            }
            this._data = new Array();
            var historyArr = new Array();
            var entityIndex = 0;
            var offset = 1;
            while (offset < decodeBuff.length) {
               try {
                  var entityObj = this.readEntity(decodeBuff, offset);
                  offset = entityObj.nextOffset;
                  this._data.push(this.decodeEntity(entityObj, entityIndex, historyArr));
                  entityIndex++;
               } catch (err) {
                  offset = decodeBuff.length + 1;
               }
            }
            resolve(true);
         }
      });
      return (promise);
   }

   /**
   * Encodes a binary Buffer to a Base85 / Ascii85 string.
   *
   * @param {Buffer} dataBuff The binary buffer to encode.
   * @param {Boolean} [useDelimiters=true] If true, the Base85 <code><~ .. ~></code>
   * bookend delimiters are included with the encoded string, otherwise the string
   * is returned without them.
   *
   *  @return {String} The Base85 / Ascii85 encoded string representation of the
   * <code>dataBuff</code> Buffer.
   */
   bufferToBase85(dataBuff, useDelimiters=true)	{
      var output = new Array();
      if (useDelimiters) {
      	output.push(0x3c);
      	output.push(0x7e);
      }
      for (var count = 0; count < dataBuff.length; count += 4) {
      	let uint32 = Buffer.alloc(4);
      	let bytes = 4;
      	for (var count2 = 0; count2 < 4; count2++) {
      		if ((count + count2) < dataBuff.length) {
      			uint32[count2] = dataBuff[count + count2];
      		} else {
      			uint32[count2] = 0x00;
      			bytes--;
      		}
      	}
      	var chunk = this.getB85EncChunk(uint32, bytes);
      	for (count2 = 0; count2 < chunk.length; count2++) {
      		output.push(chunk[count2]);
      	}
      }
      if (useDelimiters) {
      	output.push(0x7e);
      	output.push(0x3e);
      }
      var outBuff = Buffer.from(output);
      output = outBuff.toString("ascii");
      return (output);
   }

   /**
   * Encodes a Base85 / Ascii85 representation of a 32-bit unsigned integer.
   *
   * @param {Array} uint32 The data array containing values to encode.
   *
   * @return {String} A Base85 / Ascii85 representation if the input <code>uint32</code>.
   *
   * @private
   */
   getB85EncChunk(uint32) {
      var bytes = 4;
		var dataChunk = ((uint32[0] << 24) | (uint32[1] << 16) | (uint32[2] << 8) | uint32[3]) >>> 0;
		if (dataChunk === 0 && bytes == 4) {
			var output = Buffer.alloc(1);
			output[0] = 0x7a;
		} else {
			output = Buffer.alloc(bytes + 1);
			for (var count = 4; count >= 0; count--) {
				if (count <= bytes) {
					output[count] = dataChunk % 85 + 0x21;
				}
				dataChunk /= 85;
			}
		}
		return (output);
	}

   /**
   * Converts a native 32-bit value to a multibyte array.
   *
   * @param {Number} uint32 The 32-bit value to split into 4 bytes.
   * @param {Number} bytes The number of bytes in the <code>uint32</code>
   * parameter to process.
   *
   * @return {Array} A byte array containg the binary representation of
   * the input <code>uint32</code>
   *
   * @private
   */
   uint32ToArray(uint32, bytes=4) {
      var bitArr = [24, 16, 8, 0];
      let output = Buffer.alloc(bytes);
		for (var count = 0; count < bytes; count++) {
			output[count] = (uint32 >> bitArr[count]) & 0x00ff;
		}
		return (output);
	}

   /**
   * Converts a 32-bit unsigned integer value to a 4-byte array and
   * pushes it onto an existing array of 4-byte values.
   *
   * @param {Number} uint32 The unsigned 32-bit integer value to push.
   * @param {Number} uintIndex The number of bytes, minus 1, to convert
   * to a byte array from <code>uint32</code>/
   * @param {Array} uint32Array The byte array to which to append the byte
   * array created from <code>uint32</code>.
   *
   * @private
   */
   pushUint32Array(uint32, uintIndex, uint32Array)	{
      var byteArray = this.uint32ToArray(uint32, uintIndex - 1);
      for (var count = 0; count < byteArray.length; count++)  {
         uint32Array.push(byteArray[count]);
      }
   }

   /**
   * Converts a Base85 / Ascii85 string to a Buffer.
   *
   * @param {String} b85String The Base58-encoded string to convert.
   *
   * @return {Buffer} The binary data represented by the <code>b85String</code>.
   *
   * @private
   */
   base85ToBuffer(b85String) {
      var pow85Arr = [Math.pow(85,4), Math.pow(85,3), Math.pow(85,2), 85, 1];
		var output = new Array();
		var stop = false;
		var uint32 = 0;
		var uint32Index = 0;
      var position = 0;
      if ((b85String.startsWith("<~") && b85String.length) > 2) {
         var position = 2;
      }
		do	{
			if (b85String.charAt(position).trim().length === 0) {
            //skip whitespace
				continue;
         }
			var charCode = b85String.charCodeAt(position);
			switch(charCode) {
				case 0x7a:
					if (uint32Index != 0) {
						throw (new Error("Unexpected 'z' character at position " + i));
					}
					for (var count = 0; count < 4; count++)	{
						output.push(0x00);
					}
					break;
				case 0x7e:
					var nextChar = '';
					var count = position + 1; // Skip whitespace + 1;
					while (count < b85String.length && nextChar.trim().length == 0)	{
						nextChar = b85String.charAt(count++);
					}
					if (nextChar != '>') {
						throw (new Error("Broken EOD at position " + j));
					}
					if (uint32Index) {
						uint32 += pow85Arr[uint32Index - 1];
						this.pushUint32Array(uint32, uint32Index, output);
                  uint32 = uint32Index = 0;
					}
					stop = true;
					break;
				default:
					if ((charCode < 0x21) || (charCode > 0x75)) {
						throw (new Error("Unexpected character with code " + charCode + " at position " + position));
					}
					uint32 += (charCode - 0x21) * pow85Arr[uint32Index++];
					if (uint32Index >= 5) {
						this.pushUint32Array(uint32, uint32Index, output);
                  uint32 = uint32Index = 0;
					}
			}

   	} while ((position++ < b85String.length) && (stop == false));
      var outputBuff = Buffer.from(output);
		return (outputBuff);
	}

   /**
   * Reads a single SDB entity binary object and returns information about it.
   *
   * @param {Buffer} SDBBuffer The Buffer cotaining the entity to read.
   * @param {Number} offset The byte offset at which the SDB entity starts within
   * the <code>SDBBuffer</code>
   *
   * @return {Object} Contains the starting <code>offset</code> of the entity,
   * the <code>nextOffset</code> (offset of the next entity), SDB <code>headerSize</code>,
   * SDB <code>dataSize</code>, the <code>totalSize</code> (header plus data), the
   * SDB entity <code>type</code>, and a pointer Buffer to the entity <code>data</code>.
   *
   * @private
   */
   readEntity(SDBBuffer, offset) {
      var headerSize = 5; //includes type and size
      var entityType = SDBBuffer.readUInt8(offset + 0);
      var dataSize = SDBBuffer.readUInt8(offset + 1) << 24;
      dataSize = dataSize | SDBBuffer.readUInt8(offset + 2) << 16;
      dataSize = dataSize | (SDBBuffer.readUInt8(offset + 3) << 8);
      dataSize = dataSize | SDBBuffer.readUInt8(offset + 4);
      var entityData = SDBBuffer.slice(offset + headerSize, offset + headerSize + dataSize); //note that this is a shared reference, not a new instance
      var returnObj = new Object();
      returnObj.offset = offset;
      returnObj.nextOffset = offset + dataSize + headerSize;
      returnObj.headerSize = headerSize;
      returnObj.dataSize = dataSize;
      returnObj.totalSize = dataSize + headerSize;
      returnObj.type = entityType;
      returnObj.data = entityData;
      return (returnObj);
   }

   /**
   * Decodes a single SDB entity and all of the contained data elements.
   *
   * @param {Object} entityObj An entity information object such as that cerated by
   * [readEntity]{@link SDB#readEntity}.
   * @param {Number} entityIndex The index of the entity being decoded, usually reflected
   * in the entity's position within the [data]{@link SDB#data} array.
   * @param {Array} historyArr Array of objects to use to determine reference data.
   *
   * @return {Object} The native JavaScript object representation of the SDB entity
   * stored in <code>entityObj<code>.
   *
   * @private
   */
   decodeEntity(entityObj, entityIndex, historyArr) {
      var returnObj = new Object();
      switch(entityObj.type) {
         case 0:
            returnObj.entity = "api";
            break;
         case 1:
            returnObj.entity = "p2p";
            break;
         case 2:
            returnObj.entity = "peer";
            break;
         default:
            break;
      }
      var offset = 0;
      var entityData = this.readEntityData(entityObj.data, offset);
      while (entityData != null) {
         offset = entityData.offset;
         var entPropObj = this.getEntPropHistory(entityData.name, entityData.value, historyArr);
         var previousIndex = entPropObj.entityIndex;
         if (previousIndex > -1) {
            //previous entity property already exists in history
            for (var count=0; count < historyArr.length; count++) {
               var historyObj = historyArr[count];
               if ((historyObj.propName == entityData.name) && (historyObj.entityIndex == previousIndex)) {
                  entityData.value = historyObj.propValue;
               }
            }
         }
         returnObj[entityData.name] = entityData.value;
         this.addEntPropHistory (entityData.name, entityData.value, entityIndex, historyArr);
         entityData = this.readEntityData(entityObj.data, offset);
      }
      return (returnObj);
   }

   /**
   * Reads the data, properties, or name-value pair of a SDB entity.
   *
   * @param {Buffer} entityBuffer The Buffer from which to extract the entity data.
   * @param {Number} offset The offset, in bytes, of the data to extract within the
   * entity data.
   *
   * @return {Object} The extracted data <code>name</code>, <code>value</code>,
   * and an updated <code>offset</code> pointing to the next entity data object.
   *
   * @private
   */
   readEntityData(entityBuffer, offset) {
      if (entityBuffer.length == 0) {
         return (null);
      }
      if (offset >= entityBuffer.length) {
         return (null);
      }
      var returnObj = new Object();
      var descriptorType = entityBuffer.readUInt8(offset);
      var typeHeaderSize = 1; //1 byte for descriptorType
      switch (descriptorType) {
         case 0:
            //name
            var dataLength = entityBuffer.readUInt8(offset + 1) << 8;
            dataLength = dataLength | entityBuffer.readUInt8(offset + 2);
            typeHeaderSize += 2; //2 bytes for dataLength
            var sliceStart = typeHeaderSize + offset;
            var sliceEnd = dataLength + typeHeaderSize + offset;
            var entityData = entityBuffer.slice(sliceStart, sliceEnd);
            returnObj.name = "name";
            returnObj.value = entityData.toString("utf8");
            returnObj.offset = offset + entityData.length + typeHeaderSize;
            break;
         case 1:
            //description
            dataLength = entityBuffer.readUInt8(offset + 1) << 8;
            dataLength = dataLength | entityBuffer.readUInt8(offset + 2);
            typeHeaderSize += 2; //2 bytes for dataLength
            sliceStart = typeHeaderSize + offset;
            sliceEnd = dataLength + typeHeaderSize + offset;
            entityData = entityBuffer.slice(sliceStart, sliceEnd);
            returnObj.name = "description";
            returnObj.value = entityData.toString("utf8");
            returnObj.offset = offset + dataLength + typeHeaderSize;
            break;
         case 2:
            //type
            var typeVal = entityBuffer.readUInt8(offset + 1);
            typeHeaderSize += 1;
            returnObj.name = "transport";
            switch (typeVal) {
               case 0:
                  returnObj.value = "http";
                  break;
               case 1:
                  returnObj.value = "wss";
                  break;
               case 2:
                  returnObj.value = "wsst";
                  break;
               case 3:
                  returnObj.value = "webrtc";
                  break;
               default:
                  returnObj.value = "";
                  break;
            }
            returnObj.offset = offset + typeHeaderSize;
            break;
         case 3:
            //protocol
            returnObj.name = "protocol";
            typeVal = entityBuffer.readUInt8(offset + 1);
            typeHeaderSize += 1;
            switch (typeVal) {
               case 0:
                  returnObj.value = "http";
                  break;
               case 1:
                  returnObj.value = "htps";
                  break;
               case 2:
                  returnObj.value = "ws";
                  break;
               case 3:
                  returnObj.value = "wss";
                  break;
               default:
                  returnObj.value = "";
                  break;
            }
            returnObj.offset = offset + typeHeaderSize;
            break;
         case 4:
            //host
            returnObj.name = "host";
            typeVal = entityBuffer.readUInt8(offset + 1);
            typeHeaderSize += 1;
            switch (typeVal) {
               case 0:
                  //IPv4
                  var IPAddr = String(entityBuffer.readUInt8(offset + 2)) + ".";
                  IPAddr += String(entityBuffer.readUInt8(offset + 3)) + ".";
                  IPAddr += String(entityBuffer.readUInt8(offset + 4)) + ".";
                  IPAddr += String(entityBuffer.readUInt8(offset + 5));
                  typeHeaderSize += 4;
                  returnObj.value = IPAddr;
                  returnObj.offset = offset +  typeHeaderSize;
                  break;
               case 1:
                  //IPv6 -- not currently handled
                  //typeHeaderSize += 16;
                  returnObj.value = "";
                  break;
               case 2:
                  //named
                  dataLength = entityBuffer.readUInt8(offset + 1) << 8;
                  dataLength = dataLength | entityBuffer.readUInt8(offset + 2);
                  typeHeaderSize += 2; //2 bytes for dataLength
                  sliceStart = typeHeaderSize + offset;
                  sliceEnd = dataLength + typeHeaderSize + offset;
                  entityData = entityBuffer.slice(sliceStart, sliceEnd);
                  returnObj.value = entityData.toString("utf8");
                  returnObj.offset = offset + dataLength + typeHeaderSize;
                  break;
               default:
                  break;
            }

            break;
         case 5:
            //port
            returnObj.name = "port";
            entityData = entityBuffer.readUInt8(offset + 1) << 8;
            entityData = entityData | entityBuffer.readUInt8(offset + 2);
            typeHeaderSize += 2;
            returnObj.value = entityData;
            returnObj.offset = offset + typeHeaderSize;
            break;
         case 6:
            //parameters
            returnObj.name = "parameters";
            dataLength = entityBuffer.readUInt8(offset + 1) << 16;
            dataLength = dataLength | (entityBuffer.readUInt8(offset + 2) << 8);
            dataLength = dataLength | entityBuffer.readUInt8(offset + 3);
            typeHeaderSize += 3;
            sliceStart = typeHeaderSize + offset;
            sliceEnd = dataLength + typeHeaderSize + offset;
            entityData = entityBuffer.slice(sliceStart, sliceEnd);
            returnObj.value = entityData.toString("utf8");
            returnObj.offset = offset + dataLength + typeHeaderSize;
            break;
         case 7:
            //name reference
            returnObj.name = "name";
            var refIndex = entityBuffer.readUInt8(offset + 1) << 8;
            refIndex = refIndex | entityBuffer.readUInt8(offset + 2);
            //get history ref here
            typeHeaderSize += 2;
            returnObj.value = null;
            returnObj.offset = offset + typeHeaderSize;
            break;
         case 8:
            //description reference
            returnObj.name = "description";
            var refIndex = entityBuffer.readUInt8(offset + 1) << 8;
            refIndex = refIndex | entityBuffer.readUInt8(offset + 2);
            //get history ref here
            typeHeaderSize += 2;
            returnObj.value = null;
            returnObj.offset = offset + typeHeaderSize;
            break;
         case 9:
            //host reference
            returnObj.name = "host";
            var refIndex = entityBuffer.readUInt8(offset + 1) << 8;
            refIndex = refIndex | entityBuffer.readUInt8(offset + 2);
            //get history ref here
            typeHeaderSize += 2;
            returnObj.value = null;
            returnObj.offset = offset + typeHeaderSize;
            break;
         case 10:
            //port reference
            returnObj.name = "port";
            var refIndex = entityBuffer.readUInt8(offset + 1) << 8;
            refIndex = refIndex | entityBuffer.readUInt8(offset + 2);
            //get history ref here
            typeHeaderSize += 2;
            returnObj.value = null;
            returnObj.offset = offset + typeHeaderSize;
            break;
         case 11:
            //parameters reference
            returnObj.name = "parameters";
            var refIndex = entityBuffer.readUInt8(offset + 1) << 8;
            refIndex = refIndex | entityBuffer.readUInt8(offset + 2);
            //get history ref here
            typeHeaderSize += 2;
            returnObj.value = null;
            returnObj.offset = offset + typeHeaderSize;
            break;
         default:
            break;
      }
      return (returnObj);
   }

   /**
   * Converts a native JavaScript SDB entity to a compressed binary one.
   *
   * @param {Object} entityData The native JavaScript entity object to convert
   * @param {Number} entityIndex The index of the entitiy object, usually as found
   * within the [data]{@link SDB#data} array.
   * @param {Array} historyArr The history array to use to create reference
   * data entries.
   *
   * @return {Buffer} The compressed binary representaion of the <code>entityData</code>
   * including all headers.
   *
   * @private
   */
   encodeEntity(entityData, entityIndex, historyArr) {
      var returnBuff = Buffer.alloc(0);
      var header = Buffer.alloc(0);
      for (var entityProperty in entityData) {
         var entityValue = entityData[entityProperty];
         switch (entityProperty) {
            case "entity":
               //assign to header instead of returnBuff
               var header = this.encodeSDBEntityData(entityProperty, entityValue, entityIndex, historyArr);
               break;
            case "url":
               //parse compact form url
               var urlObj = new URL(entityValue);
               var protocol = urlObj.protocol;
               protocol = protocol.split(":")[0]; //no trailing ":"
               if (protocol == "") {
                  throw (new Error("Entity URL \""+entityValue+"\" uses an invalid protocol"));
               }
               var entityBuff = this.encodeSDBEntityData("protocol", protocol, entityIndex, historyArr);
               var newLength = returnBuff.length + entityBuff.length;
               returnBuff = Buffer.concat([returnBuff, entityBuff], newLength);
               var host = urlObj.hostname;
               //strip out IPv6 URL enclosure, as per https://tools.ietf.org/html/rfc2732
               host = host.split("[").join("").split("]").join("");
               entityBuff = this.encodeSDBEntityData("host", host, entityIndex, historyArr);
               newLength = returnBuff.length + entityBuff.length;
               returnBuff = Buffer.concat([returnBuff, entityBuff], newLength);
               var port = Number(urlObj.port);
               if (port != "") {
                  entityBuff = this.encodeSDBEntityData("port", port, entityIndex, historyArr);
                  newLength = returnBuff.length + entityBuff.length;
                  returnBuff = Buffer.concat([returnBuff, entityBuff], newLength);
               }
               var search = urlObj.search;
               if (search != "") {
                  entityBuff = this.encodeSDBEntityData("parameters", search, entityIndex, historyArr);
                  newLength = returnBuff.length + entityBuff.length;
                  returnBuff = Buffer.concat([returnBuff, entityBuff], newLength);
               }
               break;
            default:
               //all other entity properties encoded as-is
               var entityBuff = this.encodeSDBEntityData(entityProperty, entityValue, entityIndex, historyArr);
               newLength = returnBuff.length + entityBuff.length;
               returnBuff = Buffer.concat([returnBuff, entityBuff], newLength);
               break;
         }
      }
      //concatenate entity length to header
      var lengthHeader = new Array();
      lengthHeader.push((returnBuff.length & 0xFF000000) >> 24);
      lengthHeader.push((returnBuff.length & 0xFF0000) >> 16);
      lengthHeader.push((returnBuff.length & 0xFF00) >> 8);
      lengthHeader.push(returnBuff.length & 0xFF);
      var entityLength = Buffer.from(lengthHeader);
      newLength = header.length + entityLength.length;
      header = Buffer.concat([header, entityLength], newLength);
      newLength = header.length + returnBuff.length;
      //concatenate entity data to header
      returnBuff = Buffer.concat([header, returnBuff], newLength);
      return (returnBuff);
   }

   /**
   * Encodes an entity's data to compressed SDB-formatted binary data.
   *
   * @param {String} propName The name of the data property to encode.
   * @param {*} propValue The value of the data property to encode.
   * @param {Number} entityIndex The index of containing entity, usually within
   * the [data]{@link SDB@data} array.
   * @param {Array} historyArr The history array to add the data to.
   *
   * @return {Buffer} The SDB-encoded binary data representation of the
   * input data.
   *
   * @private
   */
   encodeSDBEntityData(propName, propValue, propIndex, historyArr) {
      var entPropObj = this.getEntPropHistory(propName, propValue, historyArr);
      propName = entPropObj.propName;
      propValue = entPropObj.propValue;
      var encData = new Array();
      switch (propName) {
         case "entity":
            switch (propValue) {
               case "api":
                  encData.push(0);
                  break;
               case "p2p":
                  encData.push(1);
                  break;
               case "peer":
                  encData.push(2);
                  break;
               default:
                  break;
            }
            break;
         case "name":
            encData.push(0);
            var propLength = propValue.length;
            if (propLength > 65535) {
               //too long, cut off remainder
               propValue = propValue.substring(0, 65535);
            }
            encData.push ((propLength & 0xFF00) >> 8);
            encData.push (propLength & 0xFF);
            for (var count=0; count < propValue.length; count++) {
               encData.push(propValue.charCodeAt(count));
            }
            break;
         case "description":
            encData.push(1);
            var propLength = propValue.length;
            if (propLength > 65535) {
               //too long, cut off remainder
               propValue = propValue.substring(0, 65535);
            }
            encData.push ((propLength & 0xFF00) >> 8);
            encData.push (propLength & 0xFF);
            for (count=0; count < propValue.length; count++) {
               encData.push(propValue.charCodeAt(count));
            }
            break;
         case "transport":
            encData.push(2);
            switch (propValue) {
               case "http":
                  encData.push(0);
                  break;
               case "wss":
                  encData.push(1);
                  break;
               case "wsst":
                  encData.push(2);
                  break;
               case "webrtc":
                  encData.push(3);
                  break;
               default:
                  break;
            }
            break;
         case "protocol":
            encData.push(3);
            switch (propValue) {
               case "http":
                  encData.push(0);
                  break;
               case "https":
                  encData.push(1);
                  break;
               case "ws":
                  encData.push(2);
                  break;
               case "wss":
                  encData.push(2);
                  break;
               default:
                  break;
            }
            break;
         case "host":
            encData.push(4);
            if (this.isIPv4(propValue)) {
               //resolved IPv4 host
               encData.push(0);
               var IPSplit = propValue.split(".");
               for (count = 0; count < IPSplit.length; count++) {
                  encData.push(parseInt(IPSplit[count]));
               }
            } else if (this.isIPv6(propValue)) {
               //resolved IPv6 host -- not currently handled
               // encData.push(1);
            } else {
               //named host
               encData.push(2);
               var propLength = propValue.length;
               if (propLength > 65535) {
                  //too long, cut off remainder
                  propValue = propValue.substring(0, 65535);
               }
               encData.push ((propLength & 0xFF00) >> 8);
               encData.push (propLength & 0xFF);
               for (count=0; count < propValue.length; count++) {
                  encData.push(propValue.charCodeAt(count));
               }
            }
            break;
         case "port":
            encData.push(5);
            encData.push((propValue & 0xFF00) >> 8);
            encData.push(propValue & 0xFF);
            break;
         case "parameters":
            encData.push(6);
            var propLength = propValue.length;
            if (propLength > 16777215) {
               //too long, cut off remainder
               propValue = propValue.substring(0, 16777215);
            }
            encData.push ((propLength & 0xFF0000) >> 16);
            encData.push ((propLength & 0xFF00) >> 8);
            encData.push (propLength & 0xFF);
            for (count=0; count < propValue.length; count++) {
               encData.push(propValue.charCodeAt(count));
            }
            break;
         case "_nameref":
            encData.push(7);
            encData.push((propValue & 0xFF00) >> 8);
            encData.push(propValue & 0xFF);
            break;
         case "_descref":
            encData.push(8);
            encData.push((propValue & 0xFF00) >> 8);
            encData.push(propValue & 0xFF);
            break;
         case "_hostref":
            encData.push(9);
            encData.push((propValue & 0xFF00) >> 8);
            encData.push(propValue & 0xFF);
            break;
         case "_portref":
            encData.push(10);
            encData.push((propValue & 0xFF00) >> 8);
            encData.push(propValue & 0xFF);
            break;
         case "_paramref":
            encData.push(11);
            encData.push((propValue & 0xFF00) >> 8);
            encData.push(propValue & 0xFF);
            break;
         default:
            break;
      }
      this.addEntPropHistory(propName, propValue, propIndex, historyArr);
      var returnBuff = Buffer.from(encData);
      return (returnBuff);
   }

   /**
   * Adds an entity's data property to a history array <i>if</i> it hasn't
   * already been added.
   *
   * @param {String} propName The name of the property to add.
   * @param {String} propValue The value of the property to add.
   * @param {Number} entityIndex The index of containing entity, usually within
   * the [data]{@link SDB@data} array.
   * @param {Array} historyArr The history array to add the data to.
   *
   * @return {Boolean} True if the data was added successfully, false if
   * it already existed.
   *
   * @private
   */
   addEntPropHistory (propName, propValue, entityIndex, historyArr) {
      for (var count = 0; count < historyArr.length; count++) {
         var historyObj = historyArr[count];
         if ((historyObj.propName == propName) && (historyObj.propValue == propValue)) {
            //already exists
            return (false);
         }
      }
      //not found, add it
      historyObj = new Object();
      historyObj.propName = propName;
      historyObj.propValue = propValue;
      historyObj.entityIndex = entityIndex;
      historyArr.push(historyObj);
      return (true);
   }

   /**
   * Retrieves entity reference data from a history array if available.
   *
   * @param {String} entityProperty The matching entity data property to retrieve.
   * @param {*} entityValue The matching entity value to retrieve.
   * @param {Array} historyArr The history array from which to retrieve the matching
   * reference data.
   *
   * @return {Object} Contains the <code>propName</code>, <code>propValue</code>
   * <code>entityIndex</code>, and <code>oldPropName</code> of the matching
   * reference data (i.e. previously stored in the history array), or
   * <code>oldPropName</code> will be null and <code>entityIndex</code> will be -1
   * if no matching reference exists (i.e. this is unique data).
   *
   * @private
   */
   getEntPropHistory(entityProperty, entityValue, historyArr) {
      var returnObj = new Object();
      for (var count = 0; count < historyArr.length; count++) {
         var historyObj = historyArr[count];
         if (historyObj.propName == entityProperty) {
            if ((historyObj.propValue == entityValue) || (entityValue == null)) {
               switch (historyObj.propName) {
                  case "name":
                     returnObj.propName = "_nameref";
                     returnObj.oldPropName = historyObj.propName;
                     returnObj.propValue = count;
                     returnObj.entityIndex = historyObj.entityIndex;
                     return (returnObj);
                     break;
                  case "description":
                     returnObj.propName = "_descref";
                     returnObj.oldPropName = historyObj.propName;
                     returnObj.propValue = count;
                     returnObj.entityIndex = historyObj.entityIndex;
                     return (returnObj);
                     break;
                  case "host":
                     returnObj.propName = "_hostref";
                     returnObj.oldPropName = historyObj.propName;
                     returnObj.propValue = count;
                     returnObj.entityIndex = historyObj.entityIndex;
                     return (returnObj);
                     break;
                  case "port":
                     returnObj.propName = "_portref";
                     returnObj.oldPropName = historyObj.propName;
                     returnObj.propValue = count;
                     returnObj.entityIndex = historyObj.entityIndex;
                     return (returnObj);
                     break;
                  case "parameters":
                     returnObj.propName = "_paramref";
                     returnObj.oldPropName = historyObj.propName;
                     returnObj.propValue = count;
                     returnObj.entityIndex = historyObj.entityIndex;
                     return (returnObj);
                     break;

               }
            }
         }
      }
      returnObj.propName = entityProperty;
      returnObj.oldPropName = null;
      returnObj.propValue = entityValue;
      returnObj.entityIndex = -1;
      return (returnObj);
   }

   /**
   * Checks whether a given string is a valid IPv4 address,
   *
   * @param {String} address The address string to evaluate.
   *
   * @return {Boolean} True if <code>address</code> is a valid IPv4 adress, false
   * otherwise.
   *
   * @private
   */
   isIPv4 (address) {
     if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(address)) {
       return (true);
     }
     return (false);
   }

   /**
   * Checks whether a given string is a valid IPv6 address,
   *
   * @param {String} address The address string to evaluate.
   *
   * @return {Boolean} True if <code>address</code> is a valid IPv6 adress, false
   * otherwise.
   *
   * @private
   */
   isIPv6 (address) {
      if (/^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(address)) {
         return (true);
      }
      return (false);
   }
}



window.SDB = SDB;
}).call(this,require("buffer").Buffer)
},{"buffer":2}]},{},[5]);
