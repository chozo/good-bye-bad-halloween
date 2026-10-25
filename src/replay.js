// ミスのリプレイで見せる説明（何をミスしたか・どこを見れば分かったか）
// 目印の位置は、キャラクターのローカル座標（足元が (0,0)、身長およそ 120）

export const NAMES = {
  pumpkin: 'かぼちゃ',
  witch: '魔女',
  vampire: 'ドラキュラ',
  cat: '猫',
  frank: 'フランケン',
  mummy: 'ミイラ',
  sheet: 'シーツおばけ',
  yurei: '幽霊',
  ochimusha: '落ち武者',
  salaryman: 'サラリーマン',
  student: '学生',
  tourist: '観光客',
  ol: '会社員',
};

const REAL_NAMES = { ...NAMES, cat: '化け猫', pumpkin: 'ジャック・オ・ランタン', sheet: 'おばけ' };

const PROP_TELLS = {
  priceTag: { text: '値札が付いたまま', at: [21, -62] },
  bag: { text: '激安の袋', at: [-22, -36] },
  can: { text: 'お酒の缶', at: [20, -50] },
};

const GHOST_LIKE = ['sheet', 'yurei', 'ochimusha'];

export function explainMiss(e, cause) {
  if (cause === 'hit-ghost') {
    const name = REAL_NAMES[e.variant];
    const tells = [];
    // 仮装でも真似できるもの（靴・しっぽ・衣装の作り）は証拠にしない
    if (e.monster) {
      tells.push({ text: '影がない', at: [0, 0] });
      tells.push({ text: '目が光っている', at: [0, e.variant === 'pumpkin' ? -103 : -97] });
      if (e.glide) tells.push({ text: '足を動かさず滑っている', at: [5, -4] });
    } else {
      tells.push({ text: '足がない', at: [4, -12] });
      tells.push({ text: '透けて浮いている', at: [0, -66] });
      tells.push({ text: '影がない', at: [0, 12] });
    }
    return {
      color: '#b46bff',
      headline: `本物の${name}でした`,
      short: `本物の${name}を叩いた`,
      sub: '本物のお化けを叩くと祟られる',
      tells,
    };
  }
  if (cause === 'hit-normal') {
    return {
      color: '#ff7a3d',
      headline: `普通の${NAMES[e.variant]}でした`,
      short: `普通の${NAMES[e.variant]}を叩いた`,
      sub: '仮装じゃない人を叩くと苦情が来る',
      tells: [
        { text: '普段の服装', at: [0, -62] },
        { text: '影がある＝人間', at: [0, 0] },
      ],
    };
  }
  // 仮装を見逃した
  const name = NAMES[e.variant];
  const tells = [];
  for (const [k, v] of Object.entries(PROP_TELLS)) if (e.props?.[k]) tells.push(v);
  tells.push({ text: 'スニーカー', at: [5, -4] });
  tells.push({ text: '影がある＝人間', at: [0, 0] });
  if (GHOST_LIKE.includes(e.variant)) tells.unshift({ text: '布の下に足がある', at: [0, (e.hemY ?? -20) + 4] });
  return {
    color: '#ff3d5a',
    headline: `${name}の仮装を見逃した`,
    short: `${name}の仮装を見逃した`,
    sub: '道玄坂に入る前に成敗しよう',
    tells,
  };
}
