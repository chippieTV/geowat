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
                const memoryView = new Uint8Array(memory.buffer);
                memoryView.set(tiffData, 0);

                // call load_tiff assuming it starts at mem 0
                instance.exports.load_tiff(0, tiffData.length);

                // do something

                tiff_stats(tiffData)
            };
            reader.readAsArrayBuffer(file);
        }
    });
})();

function tiff_stats(t) { // for typing tiff_bytes is long - just use t
    console.log("Generating TIFF stats in JS so we don't need to mess up the minimalist WAT.");
    console.log(`${t.length} bytes`);

    const stats = {
        littleEndian: t[0] === 73,

    };

    console.log(`${stats.littleEndian ? "little endian" : "big endian"} (${t[0]})`);

    // should be 16 LE/BE bits === 42. This file is OK but should consider endianness carefully
    if (t[2] !== 42) console.log("something wrong with file", t[2]);

    console.log(`First IFD byte offset === ${t[4]}`)

    // the cost to get a DataView maybe means we should grab chunks and process together to reduce overhead?
    const first_IFD_offset = new DataView(t.buffer, 4, 4).getUint32(0, stats.littleEndian);
    console.log(first_IFD_offset)
    

    let number_of_tags = new DataView(t.buffer, first_IFD_offset, 2).getUint16(0, stats.littleEndian);
    console.log("number of tags", number_of_tags);

    const raw_tag_data = new DataView(t.buffer, first_IFD_offset + 2, 12 * number_of_tags);

    // lets make a JS object with tags, and follow the inner data as necessary
    const tiff_data = {};

    for (let i = 0; i < number_of_tags; i++) {

        parseTag(raw_tag_data, i, stats.littleEndian, true);
        

    }
}
