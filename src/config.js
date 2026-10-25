// 調整値はすべてここにまとめる（試作中は値を変えて遊びながら決める）

export const CONFIG = {
  // 論理解像度（9:16）
  width: 540,
  height: 960,

  // 3Dカメラ。単位はメートル。x=左右、z=カメラからの奥行き、y=高さ
  camera: {
    focal: 687.5, // 焦点距離（px）。z=1m の 1m が何pxに見えるか
    height: 4, // カメラの高さ
    horizonY: 330, // 地平線の画面Y
  },
  personHeight: 1.7, // 人の身長（描画の 120 単位に相当）
  personScale: 1.5, // 人物を実際の遠近より何倍大きく描くか（見分けやすさのため）
  zSpawn: 34, // 人が現れる奥行き
  zLine: 5, // 規制線の奥行き。仮装した人の足元がここを越えたら「見逃し」
  zGone: 2.0, // ここまで来たら画面から消す

  maxMiss: 3,

  // 成敗した人数がこの数ごとにレベルが上がる
  levelEvery: 6,

  // レベルごとの難易度（全20段階）。最後のレベルが上限
  //   Lv1〜2 ：操作に慣れる（幽霊っぽい仮装は Lv3 から、人魂は Lv2 まで）
  //   Lv3〜8 ：見分けにくい要素が順に増える
  //   Lv9〜15：速さと人数で押す。Lv15 で裾が靴先だけ・滑る本物なし
  //   Lv16〜20：さらに速く、本物を増やし、目の光と小物を減らす（上級者向け）
  //   speed       : 歩く速さ（m/秒）
  //   interval    : 次の人が現れるまでの秒数
  //   maxOnScreen : 同時に歩いている人数の上限
  //   mix         : 出現の割合（costume=仮装した人 / ghost=本物のお化け / normal=普通の人）
  //   lookalike   : 本物のお化けのうち、仮装そっくりのモンスター（ドラキュラ・ミイラなど）の割合。残りは昔ながらの幽霊
  //   ghostLike   : 仮装のうち「幽霊っぽい仮装」（シーツ・白装束・落ち武者）の割合
  //   robeCover   : 幽霊っぽい仮装の裾が足を隠す度合い（0=足が丸見え、1=靴先だけ）
  //   ghostAlpha  : 昔ながらの幽霊の不透明度（高いほど透けず、見分けにくい）
  //   glide       : 仮装そっくりのモンスターが、足を動かさずスーッと滑る確率（低いほど人間のように歩く）
  //   eyeGlow     : 本物のお化けの目の光の強さ
  //   hitodama    : 昔ながらの幽霊に人魂が付く（分かりやすいヒント）
  //   propChance  : 仮装した人が値札・袋・缶の小物を持つ確率
  //   talkChance  : 歩いている途中でひと言しゃべる確率
  levels: [
    { speed: 5, interval: 1.7, maxOnScreen: 3, mix: { costume: 0.5, ghost: 0.25, normal: 0.25 }, lookalike: 0.4, ghostLike: 0, robeCover: 0, ghostAlpha: 0.5, glide: 1, eyeGlow: 1, hitodama: true, propChance: 0.7, talkChance: 0.5 }, // Lv1
    { speed: 5.5, interval: 1.5, maxOnScreen: 3, mix: { costume: 0.47, ghost: 0.26, normal: 0.27 }, lookalike: 0.47, ghostLike: 0, robeCover: 0, ghostAlpha: 0.53, glide: 0.86, eyeGlow: 0.93, hitodama: true, propChance: 0.63, talkChance: 0.43 }, // Lv2
    { speed: 6.1, interval: 1.33, maxOnScreen: 4, mix: { costume: 0.45, ghost: 0.28, normal: 0.27 }, lookalike: 0.54, ghostLike: 0.19, robeCover: 0.07, ghostAlpha: 0.57, glide: 0.73, eyeGlow: 0.86, hitodama: false, propChance: 0.56, talkChance: 0.36 }, // Lv3
    { speed: 6.6, interval: 1.19, maxOnScreen: 5, mix: { costume: 0.44, ghost: 0.29, normal: 0.27 }, lookalike: 0.6, ghostLike: 0.25, robeCover: 0.21, ghostAlpha: 0.62, glide: 0.59, eyeGlow: 0.78, hitodama: false, propChance: 0.5, talkChance: 0.3 }, // Lv4
    { speed: 7.1, interval: 1.07, maxOnScreen: 5, mix: { costume: 0.43, ghost: 0.3, normal: 0.27 }, lookalike: 0.66, ghostLike: 0.32, robeCover: 0.34, ghostAlpha: 0.68, glide: 0.47, eyeGlow: 0.69, hitodama: false, propChance: 0.43, talkChance: 0.26 }, // Lv5
    { speed: 7.5, interval: 0.96, maxOnScreen: 6, mix: { costume: 0.42, ghost: 0.31, normal: 0.27 }, lookalike: 0.7, ghostLike: 0.39, robeCover: 0.48, ghostAlpha: 0.72, glide: 0.36, eyeGlow: 0.61, hitodama: false, propChance: 0.37, talkChance: 0.22 }, // Lv6
    { speed: 7.9, interval: 0.89, maxOnScreen: 6, mix: { costume: 0.41, ghost: 0.32, normal: 0.27 }, lookalike: 0.74, ghostLike: 0.43, robeCover: 0.56, ghostAlpha: 0.76, glide: 0.29, eyeGlow: 0.54, hitodama: false, propChance: 0.32, talkChance: 0.18 }, // Lv7
    { speed: 8.3, interval: 0.82, maxOnScreen: 6, mix: { costume: 0.4, ghost: 0.33, normal: 0.27 }, lookalike: 0.79, ghostLike: 0.47, robeCover: 0.62, ghostAlpha: 0.79, glide: 0.23, eyeGlow: 0.48, hitodama: false, propChance: 0.28, talkChance: 0.15 }, // Lv8
    { speed: 8.8, interval: 0.77, maxOnScreen: 7, mix: { costume: 0.39, ghost: 0.34, normal: 0.27 }, lookalike: 0.82, ghostLike: 0.52, robeCover: 0.69, ghostAlpha: 0.82, glide: 0.17, eyeGlow: 0.43, hitodama: false, propChance: 0.23, talkChance: 0.12 }, // Lv9
    { speed: 9, interval: 0.71, maxOnScreen: 7, mix: { costume: 0.39, ghost: 0.34, normal: 0.27 }, lookalike: 0.84, ghostLike: 0.55, robeCover: 0.76, ghostAlpha: 0.84, glide: 0.13, eyeGlow: 0.38, hitodama: false, propChance: 0.2, talkChance: 0.1 }, // Lv10
    { speed: 9.3, interval: 0.66, maxOnScreen: 8, mix: { costume: 0.38, ghost: 0.35, normal: 0.27 }, lookalike: 0.87, ghostLike: 0.58, robeCover: 0.82, ghostAlpha: 0.87, glide: 0.09, eyeGlow: 0.34, hitodama: false, propChance: 0.17, talkChance: 0.08 }, // Lv11
    { speed: 9.6, interval: 0.62, maxOnScreen: 8, mix: { costume: 0.37, ghost: 0.36, normal: 0.27 }, lookalike: 0.9, ghostLike: 0.61, robeCover: 0.88, ghostAlpha: 0.89, glide: 0.06, eyeGlow: 0.3, hitodama: false, propChance: 0.14, talkChance: 0.07 }, // Lv12
    { speed: 9.9, interval: 0.58, maxOnScreen: 8, mix: { costume: 0.37, ghost: 0.36, normal: 0.27 }, lookalike: 0.91, ghostLike: 0.64, robeCover: 0.92, ghostAlpha: 0.91, glide: 0.03, eyeGlow: 0.27, hitodama: false, propChance: 0.11, talkChance: 0.06 }, // Lv13
    { speed: 10.1, interval: 0.54, maxOnScreen: 9, mix: { costume: 0.36, ghost: 0.37, normal: 0.27 }, lookalike: 0.93, ghostLike: 0.66, robeCover: 0.96, ghostAlpha: 0.93, glide: 0.01, eyeGlow: 0.25, hitodama: false, propChance: 0.09, talkChance: 0.05 }, // Lv14
    { speed: 10.5, interval: 0.5, maxOnScreen: 9, mix: { costume: 0.35, ghost: 0.38, normal: 0.27 }, lookalike: 0.95, ghostLike: 0.7, robeCover: 1, ghostAlpha: 0.95, glide: 0, eyeGlow: 0.22, hitodama: false, propChance: 0.06, talkChance: 0.05 }, // Lv15
    { speed: 11, interval: 0.47, maxOnScreen: 10, mix: { costume: 0.34, ghost: 0.39, normal: 0.27 }, lookalike: 0.95, ghostLike: 0.72, robeCover: 1, ghostAlpha: 0.96, glide: 0, eyeGlow: 0.2, hitodama: false, propChance: 0.05, talkChance: 0.05 }, // Lv16
    { speed: 11.5, interval: 0.44, maxOnScreen: 10, mix: { costume: 0.33, ghost: 0.4, normal: 0.27 }, lookalike: 0.95, ghostLike: 0.74, robeCover: 1, ghostAlpha: 0.97, glide: 0, eyeGlow: 0.17, hitodama: false, propChance: 0.04, talkChance: 0.04 }, // Lv17
    { speed: 12, interval: 0.41, maxOnScreen: 11, mix: { costume: 0.32, ghost: 0.41, normal: 0.27 }, lookalike: 0.96, ghostLike: 0.76, robeCover: 1, ghostAlpha: 0.97, glide: 0, eyeGlow: 0.14, hitodama: false, propChance: 0.03, talkChance: 0.04 }, // Lv18
    { speed: 12.5, interval: 0.38, maxOnScreen: 11, mix: { costume: 0.31, ghost: 0.42, normal: 0.27 }, lookalike: 0.96, ghostLike: 0.78, robeCover: 1, ghostAlpha: 0.98, glide: 0, eyeGlow: 0.12, hitodama: false, propChance: 0.02, talkChance: 0.03 }, // Lv19
    { speed: 13, interval: 0.35, maxOnScreen: 12, mix: { costume: 0.3, ghost: 0.43, normal: 0.27 }, lookalike: 0.97, ghostLike: 0.8, robeCover: 1, ghostAlpha: 0.98, glide: 0, eyeGlow: 0.1, hitodama: false, propChance: 0.02, talkChance: 0.03 }, // Lv20
  ],

  // 称号。min 人以上成敗で獲得
  titles: [
    { min: 0, name: '初心者' },
    { min: 20, name: 'ビギナー' },
    { min: 40, name: '中級' },
    { min: 60, name: 'ベテラン' },
    { min: 80, name: '上級' },
    { min: 100, name: '師範' },
    { min: 120, name: '伝説級' },
    { min: 150, name: '神話級' },
    { min: 200, name: 'AI級' },
  ],

  // 演出時間（秒）
  bustDuration: 1.6,
  cursedDuration: 1.4,
  angryDuration: 1.3,
  gameOverSlowmo: 1.2, // ゲームオーバー後、結果画面までの余韻（実時間）

  // 大型ビジョンに流れる文言
  screenMessages: [
    '仮装は禁止されていません',
    '路上飲酒は禁止です',
    'お化けは通行できます',
    '自警団は非公認です',
    '影のない方は優先通行',
  ],

  // セリフ
  lines: {
    costumeTalk: ['トリックオアトリート〜！', 'うぇーい', '写真撮ってー', 'これ3千円した', 'う、うらめしや〜（棒）', 'ガオー（照）'],
    ghostTalk: ['うらめしや…', '…寒い', '成仏したい', '…ひゅ〜', '血をくれ…', '400年ぶりの渋谷…'],
    normalTalk: ['終電が…', '会議資料…', 'ここどこ？', 'お腹すいた', '人多っ'],
    busted: ['すみません…', 'ドンキで買いました…', '帰ります…', '来年は家で…'],
    cursed: ['うらめしや〜！！', 'よくも…', '祟ってやる…', '本物だぞ！！'],
    angry: ['いたっ！なんで！？', '仮装じゃないです！', '通報しますよ！？', 'これ私服です！'],
    passed: ['セーフ〜♪', '逃げ切った〜', 'パーティー行こ〜', '道玄坂いっちゃお〜'],
  },
};
