declare namespace sjcl {
    namespace codec {
        namespace utf8String {
            function toBits(value: string): BitArray;
        }
        namespace base64 {
            function fromBits(bits: BitArray): string;
            function toBits(value: string): BitArray;
        }
    }
    namespace misc {
        function pbkdf2(password: string | BitArray, salt: string | BitArray, count?: number, length?: number): BitArray;
    }
    type BitArray = any;
}