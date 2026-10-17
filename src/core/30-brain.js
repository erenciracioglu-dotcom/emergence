// ═══════════════════════════════════════════════════════════════════
//  Emergence · brains: a tiny recurrent network per creature
//  inputs → 8 tanh neurons → outputs, plus direct input→output reflexes
// ═══════════════════════════════════════════════════════════════════
const I_BIAS = 0, I_ENERGY = 1, I_FOODL = 2, I_FOODR = 3, I_LIGHT = 4, I_LIGHTD = 5, I_THR_F = 6, I_THR_S = 7,
  I_PREY_F = 8, I_PREY_S = 9, I_KIN_F = 10, I_KIN_S = 11, I_KIN_AL = 12, I_KIN_N = 13, I_TEMP = 14,
  I_ALARM_F = 15, I_ALARM_S = 16, I_PAIN = 17, I_OSC = 18, I_MEM0 = 19, I_MEM1 = 20;
const NI = 21, NH = 8, NO = 6;
const O_TURN = 0, O_THRUST = 1, O_ATTACK = 2, O_SHARE = 3, O_MEM0 = 4, O_MEM1 = 5;
const W1_OFF = 0, W2_OFF = NI * NH, WD_OFF = NI * NH + NH * NO;
const NW = NI * NH + NH * NO + NI * NO;

const INPUT_LABELS = ['constant', 'energy', 'food left', 'food right', 'light', 'light gradient', 'threat ahead', 'threat side',
  'prey ahead', 'prey side', 'kin ahead', 'kin side', 'kin heading', 'kin nearby', 'too warm', 'alarm ahead', 'alarm side',
  'pain', 'rhythm', 'memory a', 'memory b'];
const OUTPUT_LABELS = ['turn', 'swim', 'bite', 'share', 'memory a', 'memory b'];

function brainForward(w, inp, hid, out) {
  for (let h = 0; h < NH; h++) {
    let s = 0;
    for (let i = 0; i < NI; i++) s += inp[i] * w[i * NH + h];
    hid[h] = Math.tanh(s);
  }
  for (let o = 0; o < NO; o++) {
    let s = 0;
    for (let h = 0; h < NH; h++) s += hid[h] * w[W2_OFF + h * NO + o];
    for (let i = 0; i < NI; i++) s += inp[i] * w[WD_OFF + i * NO + o];
    out[o] = s;
  }
  out[O_TURN] = Math.tanh(out[O_TURN]);
  out[O_THRUST] = 1 / (1 + Math.exp(-out[O_THRUST]));
  out[O_ATTACK] = 1 / (1 + Math.exp(-out[O_ATTACK]));
  out[O_SHARE] = 1 / (1 + Math.exp(-out[O_SHARE]));
  out[O_MEM0] = Math.tanh(out[O_MEM0]);
  out[O_MEM1] = Math.tanh(out[O_MEM1]);
}

// The reflexes a newborn lineage starts with (before noise): follow food,
// flee threats, bite prey in front, drift with kin, share when full.
function instinctBrain(rng, noise, diet) {
  diet = diet || 0;
  const w = new Float32Array(NW);
  for (let i = 0; i < NI * NH + NH * NO; i++) w[i] = rng.gauss() * 0.45;
  const D = (i, o, v) => { w[WD_OFF + i * NO + o] = v; };
  D(I_FOODL, O_TURN, 3.2); D(I_FOODR, O_TURN, -3.2);
  D(I_THR_S, O_TURN, -2.6); D(I_PREY_S, O_TURN, 0.5 + 3.2 * diet);
  D(I_KIN_S, O_TURN, 0.2); D(I_KIN_AL, O_TURN, 0.25);
  D(I_ALARM_S, O_TURN, -2.0); D(I_LIGHTD, O_TURN, 0.8); D(I_OSC, O_TURN, 0.25);
  D(I_BIAS, O_THRUST, 0.6); D(I_ENERGY, O_THRUST, -1.1); D(I_THR_F, O_THRUST, -1.6);
  D(I_PAIN, O_THRUST, 2.2); D(I_FOODL, O_THRUST, -0.7); D(I_FOODR, O_THRUST, -0.7);
  D(I_ALARM_F, O_THRUST, -0.8);
  D(I_BIAS, O_ATTACK, -1.6 + 1.2 * diet); D(I_PREY_F, O_ATTACK, 2.8); D(I_ENERGY, O_ATTACK, -0.6);
  D(I_PREY_F, O_THRUST, 1.2 * diet);
  D(I_BIAS, O_SHARE, -3.6); D(I_ENERGY, O_SHARE, 3.0);
  D(I_OSC, O_MEM0, 0.6); D(I_MEM0, O_MEM0, 0.8); D(I_PAIN, O_MEM1, 1.0); D(I_MEM1, O_MEM1, 0.7);
  for (let i = WD_OFF; i < NW; i++) w[i] += rng.gauss() * noise;
  return w;
}

function mutateBrain(w, M, rng) {
  const out = new Float32Array(w);
  if (M <= 0) return out;
  const p = 0.04 * M, pr = 0.003 * M;
  for (let i = 0; i < NW; i++) {
    const r = rng.next();
    if (r < pr) out[i] = rng.gauss() * 1.2;
    else if (r < p + pr) { const v = out[i] + rng.gauss() * 0.35; out[i] = v > 6 ? 6 : v < -6 ? -6 : v; }
  }
  return out;
}
