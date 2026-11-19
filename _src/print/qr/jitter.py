"""Robustness test: the same image under many small, seeded camera-like changes.

The fixed 21-read battery turned out to sit on a knife edge for the two classic OpenCV readers: moving
dots by a third of a pixel flips them. This test measures the rate instead: N seeded perturbations
(size 260-900 px, sub-pixel shift, rotation up to 4 degrees, mild perspective, then one of none / blur /
JPEG 55), each read by opencv, aruco and wechat. Same seed for every image, so images are compared on
identical conditions.
"""
import sys, json, cv2, numpy as np
URL = "https://jeby.us"
det_o = cv2.QRCodeDetector()
det_a = cv2.QRCodeDetectorAruco()
det_w = cv2.wechat_qrcode_WeChatQRCode()

def perturb(img, rng):
    s = int(rng.uniform(260, 900))
    im = cv2.resize(img, (s, s), interpolation=cv2.INTER_AREA)
    pad = int(s * 0.15)
    im = cv2.copyMakeBorder(im, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    h, w = im.shape[:2]
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    j = s * 0.02
    dst = src + rng.uniform(-j, j, (4, 2)).astype(np.float32) + np.float32(rng.uniform(-0.5, 0.5, 2))
    P = cv2.getPerspectiveTransform(src, dst)
    R = np.vstack([cv2.getRotationMatrix2D((w / 2, h / 2), rng.uniform(-4, 4), 1.0), [0, 0, 1]])
    im = cv2.warpPerspective(im, R @ P, (w, h), flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255))
    k = rng.integers(3)
    if k == 1:
        im = cv2.GaussianBlur(im, (0, 0), rng.uniform(0.6, 1.2))
    elif k == 2:
        im = cv2.imdecode(cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, 55])[1], 1)
    return im

def reads(im):
    o = det_o.detectAndDecode(im)[0] == URL
    a = det_a.detectAndDecode(im)[0] == URL
    w = URL in det_w.detectAndDecode(im)[0]
    return o, a, w

def run(path, n=60, seed=7):
    img = cv2.imread(path)
    rng = np.random.default_rng(seed)
    tot = np.zeros(3, int); anyr = 0
    for _ in range(n):
        r = reads(perturb(img, rng)); tot += r; anyr += any(r)
    return {"file": path, "n": n, "opencv": int(tot[0]), "aruco": int(tot[1]), "wechat": int(tot[2]), "any_reader": anyr}

if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(json.dumps(run(p)))
