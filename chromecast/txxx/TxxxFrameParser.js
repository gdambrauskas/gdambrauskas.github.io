//javascript/closure/crypt/crypt.js
/*
goog.require('goog.crypt');
obff.common.Reader.prototype.readUtf8String = function(byteCount) {
  if (byteCount == null || byteCount < 0) {
    throw Error('Could not read UTF-8 String: Byte count was not provided.');
  }
  if (byteCount == 0) {
    return '';
  }
  var bytes = this.readUint8Array(byteCount);
  return goog.crypt.utf8ByteArrayToString(bytes);
};
*/

/**
 * Converts a UTF-8 byte array to JavaScript's 16-bit Unicode.
 * @param {Uint8Array|Array<number>} bytes UTF-8 byte array.
 * @return {string} 16-bit Unicode string.
 */
utf8ByteArrayToString = function(bytes) {
  var out = [], pos = 0, c = 0;
  while (pos < bytes.length) {
    var c1 = bytes[pos++];
    if (c1 < 128) {
      out[c++] = String.fromCharCode(c1);
    } else if (c1 > 191 && c1 < 224) {
      var c2 = bytes[pos++];
      out[c++] = String.fromCharCode((c1 & 31) << 6 | c2 & 63);
    } else {
      var c2 = bytes[pos++];
      var c3 = bytes[pos++];
      out[c++] = String.fromCharCode(
          (c1 & 15) << 12 | (c2 & 63) << 6 | c3 & 63);
    }
  }
  return out.join('');
};

function log(msg) {
  console.log("gvd msg: "+msg);
}

ima = {};
ima.chromecast = {};

ima.chromecast.TxxxFrameParser = function(data/*Uint8Array*/) {
  this.data = data;
  
  var input = new Uint8Array([73,68,51,4,0,0,0,0,0,25,84,88,88,88,0,0,0,15,0,0,3,0,103,111,111,103,108,101,95,48,48,48,49,49,0]);  
  var testView = new DataView(input.buffer);  
  var b11 = testView.getUint8(0);
  log("b11 "+b11+ " "+String.fromCharCode(b11))
  
  this.position = 0;
  this.limit = data.length;
}

ima.chromecast.TxxxFrameParser.ID3_TEXT_ENCODING_ISO_8859_1 = 0;
ima.chromecast.TxxxFrameParser.ID3_TEXT_ENCODING_UTF_16 = 1;
ima.chromecast.TxxxFrameParser.ID3_TEXT_ENCODING_UTF_16BE = 2;
ima.chromecast.TxxxFrameParser.ID3_TEXT_ENCODING_UTF_8 = 3;

/**
 * Moves the reading offset by {@code bytes}.
 *
 * @throws IllegalArgumentException Thrown if the new position is neither in nor at the end of the
 *     array.
 */
ima.chromecast.TxxxFrameParser.prototype.skipBytes = function(skipNumberOfBytes) {
  this.setPosition(this.position + skipNumberOfBytes);
}

ima.chromecast.TxxxFrameParser.prototype.parse = function() {

  var id3Size = this.parseId3Header();
  
  while (id3Size > 0) {
    var byte1 = this.dataView.getUint8(this.position++);
    var byte2 = this.dataView.getUint8(this.position++);
    var byte3 = this.dataView.getUint8(this.position++);
    var byte4 = this.dataView.getUint8(this.position++);
    var frameId = String.fromCharCode(byte1) + String.fromCharCode(byte2) + String.fromCharCode(byte3) + String.fromCharCode(byte4);
    var frameSize = this.readSynchSafeInt32();
    if (frameSize <= 1) {
      break;
    }
    // Skip frame flags.
    this.skipBytes(2);
    if ('TXXX' == frameId) {
      var encoding = this.dataView.getUint8(this.position++);
      var frameDataView = new DataView(this.readBytes(frameSize - 1));
      
      // frame has description and value.
      var firstTerminatingNullIndex = this.indexOfTerminatingNull(frameDataView, 0, encoding);
      var description = this.readString(frameDataView, 0, firstTerminatingNullIndex,  encoding);
      log("description "+description)
      var value = this.readString(frameDataView, firstTerminatingNullIndex, frameDataView.byteLength,  encoding);
      log("value "+value)
    } else {
      // Don't care about other tags.
      this.skipBytes(frameSize - 1); 
    }
    id3Size -= frameSize + 10 /* header size */;
  }
}

/**
 * Sets the reading offset in the array.
 *
 * @param position Byte offset in the array from which to read.
 * @throws IllegalArgumentException Thrown if the new position is neither in nor at the end of the
 *     array.
 */
ima.chromecast.TxxxFrameParser.prototype.setPosition = function(newPosition) {
  if (newPosition < 0 || newPosition > this.limit) {
    throw new Error("Invalid read");
  }
  this.position = newPosition;
}

/**
 * Reads the next {@code length} bytes into {@code buffer} at {@code offset}.
 *
 */
ima.chromecast.TxxxFrameParser.prototype.readBytes = function(bytesCount) {
  var buffer = this.data.buffer.slice(this.position, this.position + bytesCount);
  this.position += bytesCount;
  return buffer;
}

/**
 * Reads a Synchsafe integer.
 * <p>
 * Synchsafe integers keep the highest bit of every byte zeroed. A 32 bit synchsafe integer can
 * store 28 bits of information.
 *
 * @return The parsed value.
 */
ima.chromecast.TxxxFrameParser.prototype.readSynchSafeInt32 = function() {
  var byte1 = this.dataView.getUint8(this.position++);
  var byte2 = this.dataView.getUint8(this.position++);
  var byte3 = this.dataView.getUint8(this.position++);
  var byte4 = this.dataView.getUint8(this.position++);
  return (byte1 << 21) | (byte2 << 14) | (byte3 << 7) | byte4;
}

ima.chromecast.TxxxFrameParser.prototype.readString = function(view, startIndex, terminatorIndex, encoding) {
  switch (encoding) {
    case ima.chromecast.TxxxFrameParser.ID3_TEXT_ENCODING_ISO_8859_1:
      return readNullTerminatedString(view, startIndex);

    case ima.chromecast.TxxxFrameParser.ID3_TEXT_ENCODING_UTF_16:
    case ima.chromecast.TxxxFrameParser.ID3_TEXT_ENCODING_UTF_16BE:
      return this.readNullTerminatedStringUTF16(view, startIndex);

    case ima.chromecast.TxxxFrameParser.ID3_TEXT_ENCODING_UTF_8:
      return utf8ByteArrayToString(new Uint8Array(view.buffer.slice(startIndex, terminatorIndex)));
       
    default: 
      return '';
  }
};

ima.chromecast.TxxxFrameParser.prototype.indexOfTerminatingNull = function(view, startIndex) {
  for (var i = startIndex; i < view.byteLength; i++) {
    if (view.getUint8(i) == 0) {
      return i;
    }
  }
  return -1;
};

ima.chromecast.TxxxFrameParser.prototype.readNullTerminatedStringUTF16 = function(view, startIndex) {
  var code;
  var codes = [];

  for (var i = startIndex; i < view.byteLength; i +=2) {
    var code = dataView.getUint16(pos + i);
    if (code == 0) break;
    codes.push(code);
  }

  return String.fromCharCode.apply(null, codes);
};

ima.chromecast.TxxxFrameParser.prototype.indexOfTerminatingNullUTF16 = function(view, startIndex) {
  for (var i = startIndex; i < view.byteLength; i++) {
    if (view.getUint16(i) == 0) {
      return i;
    }
  }
  return -1;
};

ima.chromecast.TxxxFrameParser.prototype.parseId3Header = function() {
  var byte1 = this.dataView.getUint8(this.position++);
  var byte2 = this.dataView.getUint8(this.position++);
  var byte3 = this.dataView.getUint8(this.position++);
  var identifier = String.fromCharCode(byte1) + String.fromCharCode(byte2) + String.fromCharCode(byte3);
  if ('ID3' != identifier) {
    throw Error("Unexpected ID3 file identifier");
  }
  
  // Skip version, this parser handles version that truman produces.
  this.skipBytes(2);

  var flags = this.dataView.getUint8(this.position++);
  
  var id3Size = this.readSynchSafeInt32();
  
  // Check if extended header is present.
  if ((flags & 0x2) != 0) {
    var extendedHeaderSize = this.readSynchSafeInt32();
    if (extendedHeaderSize > 4) {
      this.skipBytes(extendedHeaderSize - 4);
    }
    id3Size -= extendedHeaderSize;
  }

  // Check if footer presents.
  if ((flags & 0x8) != 0) {
    id3Size -= 10;
  }
  return id3Size;
}

var littleEndian = (function() {
  var buffer = new ArrayBuffer(2);
  new DataView(buffer).setInt16(0, 256, true);
  return new Int16Array(buffer)[0] === 256;
})();
console.log(littleEndian); // true or false

var data = new Uint8Array([73,68,51,4,0,0,0,0,0,25,84,88,88,88,0,0,0,15,0,0,3,0,103,111,111,103,108,101,95,48,48,48,49,49,0]);
var parser = new ima.chromecast.TxxxFrameParser(data);
parser.parse();