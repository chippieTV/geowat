/**
 * 
 * @param {DataView} raw_tag_data 
 * @param {number} offset 
 * @param {boolean} littleEndian 
 * @param {boolean} debug 
 */
export const parseTag = (raw_tag_data, offset, littleEndian, debug = false) => {
    // this is expecting the IFD gets passed a block of memory JUST for the tags
    // following the data pointers with this View is not possible
    // without access to all of the memory
    const tagID = raw_tag_data.getUint16(offset * 12, littleEndian);
    const dataTypeID = raw_tag_data.getUint16((offset * 12) + 2, littleEndian);
    const bytesInDataType = getDataTypeSize(dataTypeID);
    const values = raw_tag_data.getUint32((offset * 12) + 4, littleEndian);

    // if data type * values <= 4, then the data is inline
    // otherwise it is an offset to get the data
    const data_length = bytesInDataType * values;
    const data_is_local = data_length <= 4;
    const data_or_pointer = raw_tag_data.getUint32((offset * 12) + 8, littleEndian);

    switch(tagID) {
        case 254:
            console.log("NewSubfileType");
            break;
        case 255:
            console.log("SubfileType");
            break;
        case 256:
            console.log("ImageWidth", data_or_pointer, "px");
            break;
        case 257:
            console.log("ImageHeight", data_or_pointer, "px");
            break;
        case 258:
            console.log("BitsPerSample");
            break;
        case 259:
            console.log("Compression");
            break;
        case 262:
            console.log("PhotometricInterpretation");
            break;
        case 263:
            console.log("Thresholding");
            break;
        case 264:
            console.log("CellWidth");
            break;
        case 265:
            console.log("CellLength");
            break;
        case 266:
            console.log("FillOrder");
            break;
        case 269:
            console.log("DocumentName");
            break;
        case 270:
            console.log("ImageDescription");
            break;
        case 271:
            console.log("Make");
            break;
        case 272:
            console.log("Model");
            break;
        case 273:
            console.log("StripOffsets");
            break;
        case 274:
            console.log("Orientation");
            break;
        case 277:
            console.log("SamplesPerPixel");
            break;
        case 278:
            console.log("RowsPerStrip");
            break;
        case 279:
            console.log("StripByteCounts");
            break;
        case 280:
            console.log("MinSampleValue");
            break;
        case 281:
            console.log("MaxSampleValue");
            break;
        case 282:
            console.log("XResolution");
            break;
        case 283:
            console.log("YResolution");
            break;
        case 284:
            console.log("PlanarConfiguration");
            break;
        case 296:
            console.log("ResolutionUnit");
            break;
        case 305:
            console.log("Software");
            break;
        case 306:
            console.log("DateTime");
            break;
        case 330:
            console.log("SubIFDs");
            break;
        case 700:
            console.log("XMP");
            break;
        case 34377:
            console.log("Photoshop");
            break;
        case 34665:
            console.log("EXIF_IFD");
            break;
        default:
            console.log("Not implemented in parser yet...");
    }

    if (debug) {
        console.log(
            "Tag ID", tagID,
            "of DataType", getDataTypeString(dataTypeID),
            "with", values, "value(s) -",
            data_length, "bytes",
            "data is local", data_is_local,
            "tag data or pointer to data", data_or_pointer
        );
        
        console.log("---");
    }
}

/**
 * A function to get the number of bytes of a TIFF data type
 * 
 * Debug optionally prints a description to the console
 * 
 * @param {number} datatype 
 * @param {boolean} debug 
 * @returns {number} Number of bytes in the TIFF data type
 */
export const getDataTypeSize = (datatype, debug = false) => {
    switch(datatype) {
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