import { parseTag } from "./reader_utils.mjs";

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


    console.log(`${stats.littleEndian ? "little endian" : "big endian"} (${t[0]})`);

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
        // console.log("number of tags", number_of_tags);
        // IFD_data[`IFD_${IFD_id}`]["_IFD_offset"] = IFD_offset;
        // IFD_data[`IFD_${IFD_id}`]["_number_of_tags"] = number_of_tags;

        for (let i = 0; i < number_of_tags; i++) {
            const {field_name, ...fields} = parseTag(dataview, IFD_offset + 2, i, stats.littleEndian);
            IFD_data[`IFD_${IFD_id}`][field_name] = {
                field_name,
                ...fields
            };
        }
        console.log("last 32bits of IFD", IFD_offset + 2 + (FIELD_SIZE * number_of_tags))
        // next IFD or 0
        const next_ifd_offset = new DataView(t.buffer, IFD_offset + 2 + (FIELD_SIZE * number_of_tags), 4).getUint32(0, stats.littleEndian);
    
        console.log("next IFD offset", next_ifd_offset);
        
        if (next_ifd_offset === 0) break;

        IFD_offset = next_ifd_offset;
        IFD_id++;
    }


    console.log(t)

    // RAW IFD_data
    console.log(IFD_data);

    // parsed only 
    const parsed = Object.entries(IFD_data).reduce((acc, [k, v]) => {
        acc[k] = Object.entries(v).reduce((acc2, [k2, v2]) => {
            if (v2.parsed) {
                // ugly but still finding the data shapes that make sense..
                acc2[k2] = v2.parsed[1];
            } else {
                acc2[k2] = v2.full_data
            }

            return acc2;
        }, {});
        // }, {});

        return acc;
    }, {});

    console.log(parsed);
}

