declare module "bs58" {
  type bs58 = {
    encode: (bytes: Uint8Array | Buffer) => string;
    decode: (str: string) => Buffer;
  };

  const bs58: bs58;

  export default bs58;
}
