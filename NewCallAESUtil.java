package cn.dev10086.ability.common.utils;

import cn.dev10086.ability.common.log.AbilityLogger;
import org.apache.commons.codec.binary.Hex;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * @author zheng
 * @date 2024/11/26
 */
public class NewCallAESUtil {
    private static final String CBC_MODE = "CBC";
    private static final String PKCS5_PADDING = "PKCS5Padding";
    private static final String IV = "线下提供";
    private static final String SECRET_KEY = "线下提供";

    public NewCallAESUtil() {
    }

    public static String encryptHex(String data) {
        return encryptHex(IV, SECRET_KEY, data);
    }

    public static String decryptString(String data) {
        return decryptString(IV, SECRET_KEY, data);
    }

    public static String encryptHex(String iv, String key, String data) {
        return encryptHex(CBC_MODE, PKCS5_PADDING, iv, key, data);
    }

    public static String decryptString(String iv, String key, String data) {
        return decryptString(CBC_MODE, PKCS5_PADDING, iv, key, data);
    }

    public static String encryptHex(String mode, String padding, String iv, String key, String data) {
        return Hex.encodeHexString(encrypt(mode, padding, iv, key, data));
    }

    public static String decryptString(String mode, String padding, String iv, String key, String data) {
        return new String(decrypt(mode, padding, iv, key, data));
    }

    public static byte[] encrypt(String mode, String padding, String iv, String key, String data) {
        try {
            Cipher cipher = Cipher.getInstance("AES/" + mode + "/" + padding);
            cipher.init(1, new SecretKeySpec(key.getBytes(), "AES"), new IvParameterSpec(iv.getBytes()));
            return cipher.doFinal(data.getBytes());
        } catch (Exception var6) {
            AbilityLogger.newCallErrorLog("AES encrypt fail!", var6);
            return new byte[0];
        }
    }

    public static byte[] decrypt(String mode, String padding, String iv, String key, String data) {
        try {
            Cipher cipher = Cipher.getInstance("AES/" + mode + "/" + padding);
            cipher.init(2, new SecretKeySpec(key.getBytes(), "AES"), new IvParameterSpec(iv.getBytes()));
            return cipher.doFinal(Hex.decodeHex(data.toCharArray()));
        } catch (Exception var6) {
            AbilityLogger.newCallErrorLog("AES decrypt fail!", var6);
            return new byte[0];
        }
    }

    public static void main(String[] args) {
        String hex = encryptHex("13631789022");
        System.out.println("加密后："+hex);
        String decryptString = decryptString(hex);
        System.out.println("解密后："+decryptString);
    }
}
