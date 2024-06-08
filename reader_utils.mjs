


/**
 * 
 * @param {DataView} buffer - A DataView for the entire file (for now)
 * @param {number} initial_offset - Starting byte offset for current IFD
 * @param {number} local_offset - Tag offset within IFD (each tag is 12 bytes long)
 * @param {boolean} littleEndian - file header specified endianness
 * @param {boolean} debug 
 */
export const parseTag = (data_view, initial_offset, local_offset, littleEndian, debug = false) => {

    // this is expecting the IFD gets passed a block of memory JUST for the tags
    // following the data pointers with this View is not possible
    // without access to all of the memory
    const tag_id = data_view.getUint16(initial_offset + local_offset * 12, littleEndian);
    const data_type_id = data_view.getUint16((initial_offset + local_offset * 12) + 2, littleEndian);
    const bytes_in_data_type = getDataTypeSize(data_type_id);
    const count = data_view.getUint32((initial_offset + local_offset * 12) + 4, littleEndian);

    // if data type * count <= 4, then the data is inline
    // otherwise it is an offset to get the data
    const data_length = bytes_in_data_type * count;

    // !! NOTE if local data is LESS than 4 bytes it is left justified within the 4 bytes
    // i.e. stored in the lower-numbered bytes (I assume endianness is important here..)
    const data_is_local = data_length <= 4;

    // awkwardly named but can refactor later
    const data_or_address = data_view.getUint32((initial_offset + local_offset * 12) + 8, littleEndian);


    // if (data_is_local && !debug) {
    //     // short circuit return simplest data
    //     return {
    //         tag_id,
    //         ...getLocalValue(tag_id, data_or_address)
    //     };
    // }




    // if the data is NOT local then the 4 bytes are the location of the actual data
    const full_data = data_is_local ? data_or_address :
        getData(
            data_view,
            data_or_address,
            // override XMP data to ASCII
            tag_id === 700 ? 2 : data_type_id,
            count
        )
        ;

    // extract data for more understandable fields
    // i.e. if compression, use getCompressionString(full_data)
    
    if (debug) {
        console.log(
            "Tag ID", tag_id,
            "of DataType", getDataTypeString(data_type_id),
            "with", count, "value(s) -",
            data_length, "bytes",
            "data is local", data_is_local,
            "tag data or pointer to data", full_data
        );
        
        console.log("---");
    }

    // most of this is just for debugging
    // for some fields we could return things like '"Compression", "None"'
    // although that is also debugging/human readable and actually the next steps
    // should work on the data and process according to the values
    return {
        tag_id,
        field_name: getTagString(tag_id),
        data_type_id,
        bytes_in_data_type,
        count,
        data_length,
        data_is_local,
        full_data,
        address: !data_is_local ? data_or_address : undefined,
        parsed: data_is_local ? getLocalValue(tag_id, data_or_address) : undefined
    }

}

/**
 * Returns an array of parsed/fetched data from a tag ID and value input
 * 
 * @param {number} tag_id 
 * @param {number} value 
 * @returns {[string, string, number]}
 * 
 * [0] = Tag name
 * [1] = string description of value
 * [2] = raw value (same as input - pass through for convenience)
 */
const getLocalValue = (tag_id, value) => {
    // mostly useful when we need to parse the types further as in the compression string
    switch(tag_id) {
        // case 256:
        //     return ["ImageWidth", value, `${value}px`];
        // case 257:
        //     // ImageLength in Rows
        //     return ["ImageHeight", value, `${value}px`];
        case 259:
            return ["Compression", getCompressionString(value), value];
        case 262:
            return ["PhotometricInterpretation", getPhotometricInterpretationString(value), value];
        
        default:
            return [`not-implemented-${tag_id}`, value, value];
    }
}

/**
 * 
 * @param {number} tag_id 
 * @returns {string}
 */
const getTagString = (tag_id) => {
    switch(tag_id) {
        case 254:
            return "NewSubfileType";
        case 255:
            return "SubfileType";
        case 256:
            return "ImageWidth";
        case 257:
            return "ImageHeight";
        case 258:
            return "BitsPerSample";
        case 259:
            return "Compression";
        case 262:
            return "PhotometricInterpretation";
        case 263:
            return "Thresholding";
        case 264:
            return "CellWidth";
        case 265:
            return "CellLength";
        case 266:
            return "FillOrder";
        case 269:
            return "DocumentName";
        case 270:
            return "ImageDescription";
        case 271:
            return "Make";
        case 272:
            return "Model";
        case 273:
            return "StripOffsets";
        case 274:
            return "Orientation";
        case 277:
            return "SamplesPerPixel";
        case 278:
            return "RowsPerStrip";
        case 279:
            return "StripByteCounts";
        case 280:
            return "MinSampleValue";
        case 281:
            return "MaxSampleValue";
        case 282:
            return "XResolution";
        case 283:
            return "YResolution";
        case 284:
            return "PlanarConfiguration";
        case 296:
            return "ResolutionUnit";
        case 305:
            return "Software";
        case 306:
            return "DateTime";
        case 317:
            // LIBTIFF name TIFFTAG_PREDICTOR
            return "Predictor";
        case 322:
            // LIBTIFF name TIFFTAG_TILEWIDTH
            return "TileWidth";
        case 323:
            // LIBTIFF name TIFFTAG_TILELENGTH
            return "TileLength";
        case 324:
            // LIBTIFF name TIFFTAG_TILEOFFSETS
            return "TileOffsets";
        case 325:
            // LIBTIFF name TIFFTAG_TILEBYTECOUNTS
            return "TileByteCounts";
        case 330:
            return "SubIFDs";
        case 339:
            return "SampleFormat";
        case 700:
            return "XMP";
        case 33550:
            return "ModelPixelScaleTag";
        case 33922:
            return "ModelTiepointTag";
        case 34377:
            return "Photoshop";
        case 34665:
            return "EXIF_IFD";
        case 34735:
            return "GeoKeyDirectoryTag";
        case 34736:
            return "GeoDoubleParamsTag";
        case 34737:
            return "GeoAsciiParamsTag";
        case 37724:
            return "ImageSourceData";
        case 42112:
            return "GDAL_METADATA";
        case 42113:
            return "GDAL_NODATA";
        
        default:
            return "Not implemented in parser yet...";
    }
}

const getCompressionString = (compressionId) => {
    switch(compressionId) {
        case 1:
            return "No compression";
        case 2:
            return "CCITT modified Huffman RLE";
        case 5:
            return "LZW";
        case 7: // new style
            return "JPEG";
            // The DNG specification specifies that while Compression value 7 (JPEG) combined with
            // a PhotometricInterpretation value 6 (YCbCr) or 1 (BlackIsZero) and a uniform BitsPerSample
            // value of 8 indicates normal baseline JPEG compression, the same Compression value 7 (JPEG)
            // combined with another PhotometricInterpretation value and/or another BitsPerSample value
            // is also possible and should always indicate lossless JPEG compression (lossless sequential Huffman, SOF3).

            // A later version of the DNG specification allows for the combination of Photometric value 34892 (LinearRaw)
            // and uniform BitsPersample value 8, and either lossless or lossy JPEG compression. Taking care not to 
            // contradict the previous rule mentioned earlier, Compression value 7 should indicate lossless JPEG, and
            // a new Compression value was required to indication lossy JPEG. The newly defined Compression value is 34892.
            
            // 34892 = Lossy JPEG (should only be combined with Photometric value 34892 (LinearRaw) and uniform BitsPersample
            // value 8, indicates lossy JPEG where Compression value 7 with these Photometric and BitsPerSample values would
            // indicate lossless JPEG).
            
            // We recommend DNG writers follow this specification. DNG readers can treat Compression values 7 and 34892
            // along the same path, and use the actual JPEG markers in the compressed data to set up a correct decoding
            // chain. Any robust and liberal TIFF decoder, and not just DNG decoder, should probably be doing that anyway.

        case 8:
            return "Deflate";
        case 32946:
            return "COMPRESSION_DEFLATE";
        case 8:
            return "COMPRESSION_ADOBE_DEFLATE";
        case 32947:
            return "COMPRESSION_DCS";
        case 34661:
            return "COMPRESSION_JBIG";
        case 34712:
            return "COMPRESSION_JP2000";
        case 34892:
            // Photometric 34892 (LinearRaw) and uniform BitsPerSample 8
            return "Lossy JPEG";
    }
}

export const getUncompressedPixels = (compressionType, rawbytes) => {
    console.log("rawBytes", rawbytes);
    switch (compressionType) {
        case "No compression":
            return new Uint16Array(rawbytes);
        case "Deflate":
            return pako.inflate(rawbytes)
        default:
            console.log("compression not supported")
    }
}

const getPhotometricInterpretationString = (id) => {
    switch (id) {
        case 0: return "WhiteIsZero" // For bilevel and grayscale images: 0 is imaged as white.
        case 1: return "BlackIsZero" // For bilevel and grayscale images: 0 is imaged as black.
        case 2: return "RGB" // RGB value of (0,0,0) represents black, and (255,255,255) represents white, assuming 8-bit components. The components are stored in the indicated order: first Red, then Green, then Blue.
        case 3: return "Palette color" // In this model, a color is described with a single component. The value of the component is used as an index into the red, green and blue curves in the ColorMap field to retrieve an RGB triplet that defines the color. When PhotometricInterpretation=3 is used, ColorMap must be present and SamplesPerPixel must be 1.
        case 4: return "Transparency Mask" // This means that the image is used to define an irregularly shaped region of another image in the same TIFF file. SamplesPerPixel and BitsPerSample must be 1. PackBits compression is recommended. The 1-bits define the interior of the region; the 0-bits define the exterior of the region.
        case 5: return "Seperated" // usually CMYK.
        case 6: return "YCbCr"
        case 8: return "CIE L*a*b*" // (see also specification supplements 1 and 2)
        case 9: return "CIE L*a*b*" // alternate encoding also known as ICC L*a*b* (see also specification supplements 1 and 2)
        case 10: return "CIE L*a*b*" // alternate encoding also known as ITU L*a*b*, defined in ITU-T Rec. T.42, used in the TIFF-F and TIFF-FX standard (RFC 2301). The Decode tag, if present, holds information about this particular CIE L*a*b* encoding.
        default: return "Unknown"
        // PHOTOMETRIC_MINISWHITE = 0;
        // PHOTOMETRIC_MINISBLACK = 1;
        // PHOTOMETRIC_RGB = 2;
        // PHOTOMETRIC_PALETTE = 3;
        // PHOTOMETRIC_MASK = 4;
        // PHOTOMETRIC_SEPARATED = 5;
        // PHOTOMETRIC_YCBCR = 6;
        // PHOTOMETRIC_CIELAB = 8;
        // PHOTOMETRIC_ICCLAB = 9;
        // PHOTOMETRIC_ITULAB = 10;
        // PHOTOMETRIC_LOGL = 32844;
        // PHOTOMETRIC_LOGLUV = 32845;

        // The DNG specification adds these definitions:

        // 32803 = CFA (Color Filter Array)
        // 34892 = LinearRaw
        // 51177 = Depth
    }
}

/**
 * A function to retrieve the data from the buffer respecting type and count
 * 
 * @param {DataView} data_view - A DataView of the file
 * @param {number} offset - A byte offset to the data
 * @param {number} data_type_id - The reference to the type of data
 * @param {number} count - The number of items of data type
 * 
 * @returns {number[]} An array of items in the specific size
 */
const getData = (data_view, offset, data_type_id, count) => {

    // first lets just get everything as raw bytes
    
    // we are returning the actual data but the inputs encode it so it's actually wasteful
    // the only benefit is debugging, we can get this data when we need it rather than using
    // it to construct an alternate representation - for learning purposes lets carry on
    switch(data_type_id) {
        case 1:
            // if (debug) console.log("BYTE (8bit unsigned int)");
            return new Uint8Array(data_view.buffer.slice(offset, offset + count));
        case 2:
            // if (debug) console.log("ASCII (8bit byte containing 7bit ASCII code, the last byte must be NUL (binary zero))");
            // return new Uint8Array(data_view.buffer.slice(offset, offset + count));

            // -1 length to remove null terminator
            return [...new Uint8Array(data_view.buffer.slice(offset, offset + count -1))].map(s => String.fromCharCode(s)).join("");

            // return 1;
        case 3:
            // if (debug) console.log("SHORT (16bit 2 byte unsigned int)");
            return new Uint16Array(data_view.buffer.slice(offset, offset + count * 2));
            // return 2;
        case 4:
            // if (debug) console.log("LONG (32bit 4 byte unsigned int)");
            return new Uint32Array(data_view.buffer.slice(offset, offset + count * 4));
            // return 4;
        case 5:
            // if (debug) console.log("RATIONAL (two LONGs the first representing numerator of a fraction, the second the denominator)");
            return new Uint32Array(data_view.buffer.slice(offset, offset + count * 8));
            // return 8;
        case 6:
            // if (debug) console.log("SBYTE (8bit signed (twos compliment) int)");
            return new Int8Array(data_view).slice(offset, offset + count);
            // return 1;
        case 7:
            // if (debug) console.log("UNDEFINED (8bit byte that can contain anything depending on the definition of the field)");
            return new Int8Array(data_view).slice(offset, offset + count);
            // return 1;
        case 8:
            // if (debug) console.log("SSHORT (16bit 2 byte signed (twos compliment) int)");
            return new Int16Array(data_view.buffer.slice(offset, offset + count * 2));
            // return 2;
        case 9:
            // if (debug) console.log("SLONG (32bit 4 byte signed (twos compliment) int)");
            return new Int32Array(data_view.buffer.slice(offset, offset + count * 4));
            // return 4;
        case 10:
            // if (debug) console.log("SRATIONAL (two LONGs the first representing numerator of a fraction, the second the denominator)");
            return new Int32Array(data_view.buffer.slice(offset, offset + count * 8));
            // return 8;
        case 11:
            // if (debug) console.log("FLOAT (single precision (4-byte) IEEE format)");
            return new Float32Array(data_view.buffer.slice(offset, offset + count * 4));
            // return 4;
        case 12:
            // if (debug) console.log("DOUBLE (double precision (8-byte) IEEE format)");
            return new Float64Array(data_view.buffer.slice(offset, offset + count * 8));
            // return 8;
        default:
            // if (debug) console.log("unknown data type");
            return new Int8Array(data_view).slice(offset, offset + count); 
    }
} 

/**
 * A function to get the number of bytes of a TIFF data type
 * 
 * Debug optionally prints a description to the console
 * 
 * @param {number} data_type_id 
 * @param {boolean} debug 
 * @returns {number} Number of bytes in the TIFF data type
 */
export const getDataTypeSize = (data_type_id, debug = false) => {
    switch(data_type_id) {
        case 1:
            if (debug) console.log("BYTE (8bit unsigned int)");
            return 1;
        case 2:
            if (debug) console.log("ASCII (8bit byte containing 7bit ASCII code, the last byte must be NUL (binary zero))");
            return 1;
        case 3:
            if (debug) console.log("SHORT (16bit 2 byte unsigned int)");
            return 2;
        case 4:
            if (debug) console.log("LONG (32bit 4 byte unsigned int)");
            return 4;
        case 5:
            if (debug) console.log("RATIONAL (two LONGs the first representing numerator of a fraction, the second the denominator)");
            return 8;
        case 6:
            if (debug) console.log("SBYTE (8bit signed (twos compliment) int)");
            return 1;
        case 7:
            if (debug) console.log("UNDEFINED (8bit byte that can contain anything depending on the definition of the field)");
            return 1;
        case 8:
            if (debug) console.log("SSHORT (16bit 2 byte signed (twos compliment) int)");
            return 2;
        case 9:
            if (debug) console.log("SLONG (32bit 4 byte signed (twos compliment) int)");
            return 4;
        case 10:
            if (debug) console.log("SRATIONAL (two LONGs the first representing numerator of a fraction, the second the denominator)");
            return 8;
        case 11:
            if (debug) console.log("FLOAT (single precision (4-byte) IEEE format)");
            return 4;
        case 12:
            if (debug) console.log("DOUBLE (double precision (8-byte) IEEE format)");
            return 8;
        default:
            if (debug) console.log("unknown data type");
    }
}

/**
 * A function to get a human friendly description string of a TIFF data type
 * 
 * @param {number} datatype 
 * @returns {string} A description of the data type
 */
export const getDataTypeString = datatype => {
    switch(datatype) {
        case 1:
            return "BYTE (8bit unsigned int)";
            
        case 2:
            return "ASCII (8bit byte containing 7bit ASCII code, the last byte must be NUL (binary zero))";
            
        case 3:
            return "SHORT (16bit 2 byte unsigned int)";
            
        case 4:
            return "LONG (32bit 4 byte unsigned int)";
            
        case 5:
            return "RATIONAL (two LONGs the first representing numerator of a fraction, the second the denominator)";
            
        case 6:
            return "SBYTE (8bit signed (twos compliment) int)";
            
        case 7:
            return "UNDEFINED (8bit byte that can contain anything depending on the definition of the field)";
            
        case 8:
            return "SSHORT (16bit 2 byte signed (twos compliment) int)";
            
        case 9:
            return "SLONG (32bit 4 byte signed (twos compliment) int)";
            
        case 10:
            return "SRATIONAL (two LONGs the first representing numerator of a fraction, the second the denominator)";
            
        case 11:
            return "FLOAT (single precision (4-byte) IEEE format)";
            
        case 12:
            return "DOUBLE (double precision (8-byte) IEEE format)";
            
        default:
            return "unknown data type";
    }
}