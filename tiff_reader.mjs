import { parseTag, getTagString, getUncompressedPixels } from "./reader_utils.mjs";

(async () => {
    const response = await fetch('tiff_reader.wasm');
    const buffer = await response.arrayBuffer();
    const wasmModule = await WebAssembly.instantiate(buffer, {
        env: {
            // import env
        }
    })

    const { instance } = wasmModule;
    const memory = instance.exports.memory;

    document.getElementById('file-input').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function() {
                const arrayBuffer = reader.result;
                const tiffData = new Uint8Array(arrayBuffer);

                try {
                    // allocate memory in webassembly and copy TIFF data
                    const memoryView = new Uint8Array(memory.buffer);
                    memoryView.set(tiffData, 0);
    
                    // call load_tiff assuming it starts at mem 0
                    instance.exports.load_tiff(0, tiffData.length);
                } catch(e) {
                    console.log("Probably not enough WASM memory allocated (only works with file <64KB for now).", e);
                }

                // do something

                // JS version to base actual WASM WAT off of
                tiff_stats(tiffData)
            };
            reader.readAsArrayBuffer(file);
        }
    });
})();

const parsedFileObj = {};

/**
 * 
 * @param {ArrayBuffer} t 
 */
function tiff_stats(t) { // for typing tiff_bytes is long - just use t
    console.log("Generating TIFF stats in JS so we don't need to mess up the minimalist WAT.");
    console.log(`${t.length} bytes`);

    const stats = {
        littleEndian: t[0] === 73,
        bigtiff: t[2] === 43
    };

    // to be honest I don't think JS is the language for bigtiffs..

    if (!(t[2] === 42 || t[2] === 43)) {
        console.error("Invalid TIFF file.");
        return;
    }


    // console.log(`${stats.littleEndian ? "little endian" : "big endian"} (${t[0]})`);

    // should be 16 LE/BE bits === 42. This file is OK but should consider endianness carefully
    
    // if bigtiff, each IFD field is 20bytes, not 12bytes


    // console.log(`First IFD byte offset === ${t[4]}`)

    // not sure how we pass 64bit JS values around (for IFD offsets) or if we need to keep making BigInt64 arrays for single values?
    // seems that loading a file > 4GB is already quite unlikely in the browser so this only applies to the server
    // consider again after regular TIFF support
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView#64-bit_integer_values
    let IFD_offset = stats.bigtiff
        ? new BigInt64Array([t.buffer.slice(8, 16)]) // untested
        : new DataView(t.buffer, 4, 4).getUint32(0, stats.littleEndian)
        ;

    const FIELD_SIZE = stats.bigtiff ? 20 : 12;

    if (stats.bigtiff) {
        console.error("BigTIFF.. use different language?! Not currently supported.");
        return;
    }
    
    const dataview = new DataView(t.buffer);

    // lets make a JS object with tags, and follow the inner data as necessary
    const IFD_data = {};
    let IFD_id = 0;

    while (true) {
        IFD_data[`IFD_${IFD_id}`] = {};

        const number_of_tags = new DataView(t.buffer, IFD_offset, 2).getUint16(0, stats.littleEndian);

        for (let i = 0; i < number_of_tags; i++) {
            const {field_name, ...fields} = parseTag(dataview, IFD_offset + 2, i, stats.littleEndian);
            IFD_data[`IFD_${IFD_id}`][field_name] = {
                field_name,
                ...fields
            };
        }

        // next IFD or 0
        const next_ifd_offset = new DataView(t.buffer, IFD_offset + 2 + (FIELD_SIZE * number_of_tags), 4).getUint32(0, stats.littleEndian);
    
        // last IFD is marked with 0
        if (next_ifd_offset === 0) break;

        IFD_offset = next_ifd_offset;
        IFD_id++;
    }


    // console.log(t)

    // RAW IFD_data
    console.log(IFD_data);

    // parsed only

    // outer reduce runs through all IFDs
    const parsed = Object.entries(IFD_data).reduce((acc, [k, v]) => {

        // we need to init the object to write deeply into it
        acc[k] = {};


        // inner reduce simplifies the object, stripping metadata such as types and counts
        // since that data is parsed so that the final data should be in its correct form
        acc[k] = Object.entries(v).reduce((acc2, [k2, v2]) => {
            if (v2.parsed) {
                // special case, GeoKeyDirectoryTag contains fields that reference other TIFF tags
                // specifically the GeoAsciiParamsTag. It may be more efficient to do differently
                // but easier to understand running through this second pass

                if (k2 === "GeoKeyDirectoryTag") {
                    console.log(k2, v2, IFD_data["IFD_0"])
                
                    console.log(acc)

                    Object.entries(v2.parsed[1]).forEach(([geoKeyK, geoKeyV]) => {
                        // populate (side effect..) IFD_0 with simple parsed KV

                        if (!acc["GeoKeys"]) {
                            acc["GeoKeys"] = {};
                        }

                        if (Array.isArray(geoKeyV[1])) {
                            // we need to find the entry in IFD_0

                            const geoKeyTiffTagData =
                                IFD_data["IFD_0"][getTagString(geoKeyV[1][0])]
                                .full_data
                                .slice(geoKeyV[1][2], geoKeyV[1][1] -1);

                            // the array in geoKeyV is [TiffTagID, Count, Offset]
                            // where offset is the offset into the field in the tiff tag
                            // and count is the number of values to read from that tag's data
                            acc["GeoKeys"][geoKeyK] = geoKeyTiffTagData;
                            // acc["IFD_0"][geoKeyK] = geoKeyTiffTagData;

                        } else {
                            console.log(geoKeyK)
                            console.log(geoKeyV)
                            // strip out the ID and put in IFD_0
                            acc["GeoKeys"][geoKeyK] = geoKeyV[1];
                            // acc["IFD_0"][geoKeyK] = geoKeyV[1];
                        }
                    })
                
                    
                
                
                } else {
                    // ugly but still finding the data shapes that make sense..
                    acc2[k2] = v2.parsed[1];
                }


            } else {
                acc2[k2] = v2.full_data
            }

            return acc2;
        }, {});
        

        // messy but lets calculate some additional derived fields
        // byte offsets for range requests indexed Y,X
        // (just for reading order convenience)

        // NOTE if the IFD doesn't have more than one tile it will be local value
        // not array! In my test file IFD_6 only has a single tile so the TileOffsets
        // and TileByteCounts are just values
        if (acc[k].TileLength && acc[k].TileWidth) {
            // assume ImageHeight and ImageWidth
            // !! I named ImageHeight even though it's actually ImageLength !!

            const X_TILES = Math.ceil(acc[k].ImageWidth / acc[k].TileWidth);
            const Y_TILES = Math.ceil(acc[k].ImageHeight / acc[k].TileLength);

            acc[k].YX_Tile_Offsets = [];

            for (let y = 0; y < Y_TILES; y++) {
                acc[k].YX_Tile_Offsets[y] = [];

                for (let x = 0; x < X_TILES; x++) {
                    // [start, end, length]
                    acc[k].YX_Tile_Offsets[y][x] = [
                        acc[k].TileOffsets[y * X_TILES + x],
                        acc[k].TileOffsets[y * X_TILES + x] + acc[k].TileByteCounts[y * X_TILES + x],
                        acc[k].TileByteCounts[y * X_TILES + x],
                    ];
                }
            }

        }

        return acc;
    }, {});

    console.log(parsed);




    // lets try writing some pixels
    
    const canvas = document.getElementById("debug_canvas");
    const ctx = canvas.getContext("2d");

    // TILE CONTROLS - ADD UI
    const ifd = "IFD_0";
    const tile_idx = 38;




    // we have test data with deflate, use pako to extract the pixel data from the tile

    // we don't know what pixels are just by looking at the output of decompression
    // need to confirm with IFD
    const pixels = new DataView(getUncompressedPixels(
        parsed[ifd].Compression,
        t.buffer.slice(
            // index into tile 1
            parsed[ifd].TileOffsets[tile_idx],
            parsed[ifd].TileOffsets[tile_idx] + parsed[ifd].TileByteCounts[tile_idx]
        )
    ).buffer);

    // console.log(pixels)

    // console.log(new Uint16Array(pixels.buffer))


    const PIXELS_ARE_16BIT = parsed[ifd].BitsPerSample === 16;

    // scale data to 8 bit and put in each of RGB channels
    const PIXEL_COUNT = parsed[ifd].TileWidth * parsed[ifd].TileLength;

    const processedPixels = new Uint8ClampedArray(PIXEL_COUNT * 4);

    for (let i = 0; i < PIXEL_COUNT; i++) {
        // the data may be 8 or 16 bit .. check in IFD and hard coded bitshift scale for now
        // const pixelval = pixels[i];
        const pixelval = PIXELS_ARE_16BIT
            // little endian means we are reading the right 8 bits as most significant
            // and if we scale by bit-shifting 8 bits right, we essentially just discard
            // the higher frequency data again, so we only need the most significant
            // if we want to apply gamma or other tone mapping to the 16->8 bit conversion
            ? pixels.getUint8(i*2+1)
            : pixels.getUint8(i);

        processedPixels[i << 2] = pixelval; // R
        processedPixels[(i << 2) + 1] = pixelval; // G
        processedPixels[(i << 2) + 2] = pixelval; // B
        processedPixels[(i << 2) + 3] = 255; // A

    }



    const image_data = new ImageData(
        processedPixels,
        parsed[ifd].TileWidth,
        parsed[ifd].TileLength,
    );

    // console.log(image_data)

    ctx.putImageData(
        image_data,
        0,
        0
    )



}

