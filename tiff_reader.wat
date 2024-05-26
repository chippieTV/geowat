(module
    (memory (export "memory") 1)

    (func $load_tiff (param $ptr i32) (param $len i32)
        ;; reader the TIFF header (first 8 bytes)

        ;;              +-------+-------------+-----------------+
        ;; Byte Offset: | 0     | 2           | 4               |
        ;;              +---------------------------------------+
        ;; Size:        | Word  | Word        | Long            |
        ;;              +---------------------------------------+
        ;; Content:     | Byte  | Version (42)| Offset to first |
        ;;              | Order |             | IFD             |
        ;;              +-------+-------------+-----------------+

        (local $byte_order i32)
        (local $version i32)
        (local $ifd_offset i32)


        ;;              +---------+-------------------+-----------------+
        ;; Byte Offset: | 0       | 2                 | 2 + n Tags * 12 |
        ;;              +-----------------------------------------------+
        ;; Size:        | Word    | 12 Bytes * n Tags | Unsigned Long   |
        ;;              +-----------------------------------------------+
        ;; Content:     | Number  | Tag Data          | Offset to Next  |
        ;;              | of Tags |                   | IFD (or 0)      |
        ;;              +---------+-------------------+-----------------+

        (local $number_of_tags i32)
        (local $tag_offset i32)


        ;;              +--------+--------------+----------------+-----------------+
        ;; Byte Offset: | 0      | 2            | 4              | 8               | 
        ;;              +----------------------------------------------------------+
        ;; Size:        | Word   | Word         | Unsigned Long  | Variable        |
        ;;              +----------------------------------------------------------+
        ;; Content:     | Tag ID | Tag Datatype | Number of      | Tag Data or     |
        ;;              |        |              | Values         | Pointer to Data |
        ;;              +--------+--------------+----------------+-----------------+


        (local.set $byte_order
            (i32.load8_u                ;; load a single byte from the start of the memory
                (local.get $ptr)        ;; pointer to start of memory
            )
        )

        (local.set $version             ;; magic number should be 42 if TIFF file is valid
            (i32.load16_u               ;; load a two bytes from the second position
                (i32.add
                    (local.get $ptr)    ;; pointer to start of memory
                    (i32.const 2)       ;; offset of 2
                )
            )
        )

        (local.set $ifd_offset
            (i32.load                   ;; load 4 bytes (long) 
                (i32.add                ;; get the entry and offset to first IFD
                    (local.get $ptr)    ;; entry point 0
                    (i32.const 4)       ;; 4th byte of TIFF header is offset to first IFD
                )
            )
        )

        ;; first IFD
        (local.set $number_of_tags
            (i32.load16_u               ;; load 4 bytes (long) 
                (local.get $ifd_offset) ;; entry point 0
            )
        )

        (local.set $tag_offset
            (i32.add
                (local.get $ifd_offset)
                (i32.const 2)
            )
        )

        (call $read_ifd_tags (local.get $tag_offset) (local.get $number_of_tags))
    )

    ;; we need to loop $number_of_tags times grabbing 12 bytes from the $offset_to_XXX_ifd
    (func $read_ifd_tags (param $first_tag_offset i32) (param $number_of_tags i32)
        ;; create a local var and init to 0
        (local $i i32)
        (local $tmp_tag_value i32)

        (block $block ;; label to break out of loop
            (loop $loop
                ;; get starting memory offset IFD + 2 bytes

                ;; if $i is less than $number_of_tags, continue loop iteration
                (br_if $block
                    (i32.ge_u
                        (local.get $i)
                        (local.get $number_of_tags)
                    )
                )

                ;; DO SOMETHING!

                ;; read the tag number
                ;; later we should act on it, but first just read it and put into temp location
                ;; to confirm looping works
                (local.set $tmp_tag_value
                    ;; read 2 bytes from start of tag to get Tag ID
                    (i32.load16_u
                        (i32.add
                            (local.get $first_tag_offset)
                            (i32.mul
                                (i32.const 12) ;; 12 byte offset
                                (local.get $i) ;; current iteration
                            )
                        
                        )
                    )
                )

                ;; add 12 bytes to get to next tag until we have read them all



                ;; increment the loop
                (local.set $i
                    (i32.add
                        (local.get $i)
                        (i32.const 1)
                    )
                )

                ;; jump back to loop
                (br $loop)
            )
        )
    )

    (export "load_tiff" (func $load_tiff))
)
