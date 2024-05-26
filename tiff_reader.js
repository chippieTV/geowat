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
            };
            reader.readAsArrayBuffer(file);
        }
    });
})();
