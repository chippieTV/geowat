# Reading TIFF with WASM

## Goals
Make a tiny TIFF reader ideally with no dependencies. Only needs to support a small subset of TIFF's functionality, i.e. the bigger goal is GeoTIFF and COG with the least amount of code and greatest understanding.. also .. just for fun.

- read a TIFF file and extract metadata using only WAT
- get pixels out of the the TIFF file and display somehow
    - write to a canvas
    - write directly to a WebGL/WebGPU texture?
- extract GeoTIFF metadata
- consider how to calculate appropriate `range-requests` to use for COGs (this could be useful for some edge server or something).

## Building
To build the WASM file you need to install `wat2wasm` using the following in your working directory `npm i wat-wasm`. You can install it globally but it asked for sudo so I opted to install locally to the project.

Once installed you can build the WASM file from the WAT using the following, replacing FILENAME with the appropriate file you wish to build. Be aware since it's not installed globally you have to reference the binary manually, you could add this to your PATH so you don't need to but that seems a bit heavy handed at the project level..

`./node_modules/.bin/wat2wasm FILENAME.wat`

To aid debugging adding the `--debug-names` flag will preserve variables names inside the WASM, rather than everything showing up as `$var0` to `$varN`.


## Running
The HTML file that hosts the WASM requires a simple webserver. This is easiest achieved with `python3 -m http.server` which will open a basic HTTP server on port 8000. Then you can just visit `http://localhost:8000/tiff-reader.html` and load the example files.

First step is using the Chrome Dev Tools to inspect the WASM as it runs. The basic flow of this is:

- load the page (reloading to reset dev tools)
- add a breakpoint to `tiff_reader.js` in the sources tab (this could be either inside the `onload` function if you want to see the raw TIFF bytes before they hit WASM, or on the `instance.exports.load_tiff` line)
- pick a test TIFF file
- the debugger will drop you at your break point. You can step over each line as you wish, but step INTO when you get to instance.exports to go inside WASM
- step through the WASM watching it jump around the TIFF file, reading and writing data :D

## Progress

Reading into a COG (Cloud Optimized Geotiff) file generated with GDAL from Landsat data. The file was generated without compression to keep this first PoC simple, and the COG image pyramid was generated as part of the goal is understanding how to calculate range requests.

Reading IFDs, hard coded reading internal TIFF tiles and writing to canvas. The data read out is 16bit single band, so it is scaled back to 8 bit for display. All RGB values in the canvas are from the same scaled data giving a greyscale image.

![alt text](https://github.com/chippieTV/geowat/blob/main/reading-from-cog.png?raw=true)



For any GIS manipulation, understanding and doing further processing based on these tags will be key..
![alt text](https://github.com/chippieTV/geowat/blob/main/IFD_0.png?raw=true)


Also of note, only `IFD_0` has relevant GIS information, the rest of the IFDs' metadata seem related only to the pixel data inside them.
![alt text](https://github.com/chippieTV/geowat/blob/main/IFD_0_vs_other.png?raw=true)



---

A couple of points of note:
- Every build the browser seems to give the WASM file a different hash in the sources panel, so wherever you set breakpoints you will need to go back to the `instance.exports` line in the JS and step INTO the WASM file and add your breakpoints back in.
- The WASM memory is set to a single 'page' (64KB) which is enough for the small sample image but not enough for real world TIFF data. Consider how to calculate the appropriate size for this or load in small chunks if that makes sense? TBD
- There is no mechanism to do anything yet besides loading bytes and reading directly inside of Chrome Dev Tools. Need to figure out what is necessary to bounce useful data back to the browser. This partly comes under writing to texture etc., however beyond that, writing out metadata to the browser as parsed from WASM for debugging would be nice. For now I am making this functionality in JS and plan to take only the minimum useful parts and rewrite into the WASM module (i.e. I don't need to identify the human readable names of tags, only for debugging).
- The goal is for minimalism so ideally no logging, no C stdlib, just keeping the WASM as small as possible. At the same time it may be reasonable to expand on this later since TIFF files are generally huge, worrying about saving a few bytes in the program at the expense of stability seems ill advised.


## References

https://www.loc.gov/preservation/digital/formats/content/tiff_tags.shtml