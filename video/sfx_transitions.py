"""Six soft, different transition sounds (one per scene cut, cycled) so cuts never repeat the same whoosh."""
import sys, wave
import numpy as np
SR = 48000
OUT = sys.argv[1]
rng = np.random.default_rng(7)

def t(d): return np.arange(int(SR * d)) / SR

def env(n, attack, release):
    e = np.ones(n); a = int(SR * attack); r = int(SR * release)
    e[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    e[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return e

def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.zeros_like(x); s = 0.0
    for i, v in enumerate(x):
        s = (1 - a) * v + a * s; y[i] = s
    return y

def mallet(f, d=1.1, decay=4.0):
    tt = t(d)
    return (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 10)) * np.exp(-tt * decay) * env(len(tt), 0.004, 0.05)

def save(name, x, peak=0.5):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    st = np.stack([x, x], 1)
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())

# 1 airy breath: filtered noise that swells and fades
n = rng.standard_normal(int(SR * 0.9)); save("sfx-t1", lowpass(lowpass(n, 900), 900) * env(len(n), 0.35, 0.5), 0.35)
# 2 warm pad: soft fifth (C5 + G5), slight detune
tt = t(1.2); save("sfx-t2", (np.sin(2*np.pi*523.25*tt) + np.sin(2*np.pi*524.4*tt) + 0.6*np.sin(2*np.pi*783.99*tt)) * env(len(tt), 0.18, 0.9), 0.32)
# 3 single mallet note (E5)
save("sfx-t3", mallet(659.25), 0.4)
# 4 two-note rising mallet (A4 -> E5)
a, b = mallet(440.0, 1.0), mallet(659.25, 1.0); x = np.zeros(len(a) + int(SR * 0.11)); x[:len(a)] += a; x[int(SR*0.11):] += b; save("sfx-t4", x, 0.4)
# 5 glassy shimmer: high soft partials with gentle tremolo
tt = t(1.1); save("sfx-t5", (np.sin(2*np.pi*1318.5*tt) + 0.7*np.sin(2*np.pi*1975.5*tt)) * (0.8 + 0.2*np.sin(2*np.pi*7*tt)) * env(len(tt), 0.08, 0.95), 0.22)
# 6 low soft swell: warm sine glide with a whisper of noise
tt = t(0.9); f = np.linspace(220, 330, len(tt)); ph = 2*np.pi*np.cumsum(f)/SR
n = lowpass(rng.standard_normal(len(tt)), 600)
save("sfx-t6", (np.sin(ph) + 0.15*n/np.max(np.abs(n))) * env(len(tt), 0.3, 0.55), 0.32)
print("ok")
