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

                // allocate memory in webassembly and copy TIFF data
                // const memoryView = new Uint8Array(memory.buffer);
                // memoryView.set(tiffData, 0);

                // call load_tiff assuming it starts at mem 0
                // instance.exports.load_tiff(0, tiffData.length);

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

    };

    console.log(`${stats.littleEndian ? "little endian" : "big endian"} (${t[0]})`);

    // should be 16 LE/BE bits === 42. This file is OK but should consider endianness carefully
    if (t[2] !== 42) console.log("something wrong with file", t[2]);

    // console.log(`First IFD byte offset === ${t[4]}`)

    let IFD_offset = new DataView(t.buffer, 4, 4).getUint32(0, stats.littleEndian);
    
    const dataview = new DataView(t.buffer);

    // lets make a JS object with tags, and follow the inner data as necessary
    const IFD_data = {};
    let IFD_id = 0;

    while (true) {
        IFD_data[`IFD_${IFD_id}`] = {};

        const number_of_tags = new DataView(t.buffer, IFD_offset, 2).getUint16(0, stats.littleEndian);
        // console.log("number of tags", number_of_tags);
        IFD_data[`IFD_${IFD_id}`]["_IFD_offset"] = IFD_offset;
        IFD_data[`IFD_${IFD_id}`]["_number_of_tags"] = number_of_tags;

        for (let i = 0; i < number_of_tags; i++) {
            const {field_name, ...fields} = parseTag(dataview, IFD_offset + 2, i, stats.littleEndian);
            IFD_data[`IFD_${IFD_id}`][field_name] = {
                field_name,
                ...fields
            };
        }
        console.log("last 32bits of IFD", IFD_offset + 2 + (12 * number_of_tags))
        // next IFD or 0
        const next_ifd_offset = new DataView(t.buffer, IFD_offset + 2 + (12 * number_of_tags), 4).getUint32(0, stats.littleEndian);
    
        console.log("next IFD offset", next_ifd_offset);
        
        if (next_ifd_offset === 0) break;

        IFD_offset = next_ifd_offset;
        IFD_id++;
    }


    console.log(t)

    console.log(IFD_data);
}

