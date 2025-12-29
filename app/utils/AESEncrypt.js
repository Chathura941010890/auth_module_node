//Functions to authorize to the PDC backend.
//It uses Advanced Encryption Standard(AES) encryption algorithm.

const crypto = require('crypto');

const backEndDedicatedCode = "INQUBE-AUTH-MODULE"

// Function to encrypt text
const encrypt = async (text, key) => {
    const iv = crypto.randomBytes(16); // Initialization vector
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

// Function to decrypt text
const decrypt = async (encryptedText, key) => {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encrypted = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const callEncrypt = async (code) => {
    const key = crypto.randomBytes(32);

    const encryptedCode = await encrypt(code, key);

    return {code : encryptedCode, key : key}
}

async function callDecrypt(key, code) {
   
    const codeX = await decrypt(code, key);

    if(codeX == backEndDedicatedCode){
        return "success";
    }
    else{
        return "fail";
    }
}

module.exports = {
    callEncrypt,
    callDecrypt
}
