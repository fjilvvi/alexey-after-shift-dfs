import Phaser from 'phaser';

/** Hand-drawn, layered pixel-cluster customers; all textures remain transparent. */
export function makeCustomers(scene: Phaser.Scene): void {
  const OUT = 0x211c39;
  const g = scene.make.graphics({ x: 0, y: 0 });
  const rect = (x: number, y: number, w: number, h: number, c: number) => g.fillStyle(c).fillRect(x, y, w, h);
  const poly = (points: number[], c: number) => {
    g.fillStyle(c); g.fillPoints(points.reduce<Phaser.Geom.Point[]>((acc, _, i) => {
      if (i % 2 === 0) acc.push(new Phaser.Geom.Point(points[i], points[i + 1])); return acc;
    }, []), true);
  };
  const face = (x: number, y: number, skin: number, shadow: number, hair: number, older = false) => {
    poly([x+8,y,x+30,y,x+38,y+8,x+40,y+30,x+34,y+44,x+14,y+48,x+4,y+36,x,y+14], OUT);
    poly([x+10,y+4,x+28,y+4,x+34,y+12,x+34,y+32,x+28,y+40,x+14,y+42,x+6,y+32,x+6,y+14], skin);
    poly([x+28,y+12,x+34,y+12,x+34,y+32,x+28,y+40,x+18,y+42,x+18,y+36,x+28,y+30], shadow);
    rect(x+2,y+16,6,14,shadow); rect(x+6,y+18,4,6,skin);
    poly([x+8,y,x+30,y,x+38,y+8,x+36,y+16,x+30,y+12,x+26,y+8,x+12,y+12,x+4,y+16,x+2,y+10], hair);
    rect(x+12,y+18,8,4,OUT); rect(x+26,y+18,8,4,OUT);
    rect(x+14,y+22,4,4,0xf9e8d5); rect(x+28,y+22,4,4,0xf9e8d5);
    rect(x+16,y+22,2,4,OUT); rect(x+30,y+22,2,4,OUT);
    rect(x+22,y+24,4,8,shadow); rect(x+22,y+30,6,2,OUT);
    rect(x+16,y+36,12,2,OUT); rect(x+18,y+38,8,2,0xe29983);
    rect(x+10,y+12,14,2,0xffffff); // tiny clipped arcade highlight
    if (older) {
      rect(x+12,y+32,6,2,shadow); rect(x+28,y+30,6,2,shadow);
      rect(x+14,y+34,16,4,0xe1d1bd); rect(x+16,y+38,12,2,0x7c6471);
      rect(x+6,y+6,4,14,0xd7cbd0); rect(x+30,y+8,6,10,0x918caa);
    }
  };
  const shoes = (left: number, right: number, y: number) => {
    poly([left,y,left+20,y,left+22,y+12,left+18,y+18,left-8,y+18,left-10,y+12],OUT);
    poly([left+2,y+2,left+16,y+2,left+18,y+12,left-6,y+12,left-4,y+8],0xd8d6e1);
    rect(left-6,y+12,24,4,0x7e849e); rect(left-6,y+16,24,2,0xffe1b1);
    rect(left+2,y+4,12,2,0xffffff); rect(left,y+8,14,2,0x6e6c88);
    poly([right,y,right+20,y,right+28,y+12,right+26,y+18,right-2,y+18,right-4,y+12],OUT);
    poly([right+2,y+2,right+16,y+2,right+24,y+12,right,y+12],0xbec4db);
    rect(right,y+12,24,4,0x747b9a); rect(right,y+16,24,2,0xffe1b1);
    rect(right+4,y+4,12,2,0xffffff); rect(right+6,y+8,14,2,0x6e6c88);
  };

  // Customer 01: tall, slightly awkward turquoise runner, carrying a shaker.
  g.clear();
  poly([36,116,72,116,78,140,72,198,48,198,48,164,42,194,20,194,24,158,26,134],OUT);
  poly([34,120,54,120,48,158,42,190,24,190,30,152],0x258d99);
  poly([54,120,68,120,72,142,68,194,52,194,52,156],0x287181);
  rect(32,132,4,38,0x73d5c9); rect(62,140,4,42,0x4cabae);
  poly([30,56,60,54,78,64,84,108,74,122,28,122,16,106,18,72],OUT);
  poly([32,60,58,58,74,68,78,104,70,116,30,116,22,102,24,74],0x36a9aa);
  poly([30,66,42,62,40,110,28,112,22,98,24,76],0x68d5c6);
  poly([60,62,74,68,78,104,70,116,62,112,66,92],0x247580);
  rect(46,64,4,52,0xd5e3cc); rect(48,64,2,52,0x315877);
  poly([22,70,14,76,10,104,14,120,24,122,28,114,24,104,28,80],OUT);
  poly([20,78,16,104,18,114,22,114,20,104,24,80],0x61caba);
  poly([72,72,80,72,88,94,88,110,80,118,72,112,74,100],OUT);
  poly([76,78,82,98,82,108,78,110,78,98],0x2a8a96);
  rect(14,116,12,12,0xe6ad87); rect(16,116,6,8,0xffc6a0);
  rect(76,108,12,12,0xe6ad87); rect(78,108,6,8,0xffc6a0);
  rect(74,110,18,4,OUT); rect(76,114,14,22,OUT); rect(78,116,10,16,0x9fdbcc);
  rect(78,112,10,4,0xefe9c9); rect(80,120,6,6,0x2f8e99);
  rect(38,48,18,16,OUT); rect(42,48,12,14,0xe7ae89);
  face(28,8,0xf1b990,0xc77c63,0x5a3640);
  rect(46,12,12,4,0x845044); rect(42,4,18,6,0x392b3b);
  shoes(24,52,190);
  g.generateTexture('customer0',108,220);

  // Customer 02: coral hoodie, dark leggings, high ponytail and expressive stance.
  g.clear();
  poly([34,120,76,120,78,146,72,198,50,198,50,160,44,198,22,198,28,154],OUT);
  poly([38,124,54,124,48,158,40,194,26,194,34,152],0x3d344f);
  poly([56,124,72,124,72,148,68,194,54,194,54,154],0x4d3e5f);
  rect(34,150,4,28,0x735779); rect(62,158,4,30,0x80617c);
  poly([28,58,68,58,84,76,82,112,72,132,30,132,16,108,16,76],OUT);
  poly([30,64,66,64,78,78,76,110,68,126,32,126,22,106,22,78],0xed777e);
  poly([28,70,40,66,36,106,40,122,30,122,22,102,24,78],0xffa18b);
  poly([64,66,76,78,76,110,68,126,58,124,66,104],0xc55376);
  poly([34,64,38,54,60,54,68,64,60,74,42,74],0xb74768);
  rect(42,64,4,20,0xffdbaf); rect(58,64,4,20,0xffdbaf);
  rect(36,106,26,4,0xb94f6d); rect(40,110,18,10,0xda667b);
  poly([20,74,10,84,8,106,16,122,28,122,32,110,22,102,26,86],OUT);
  poly([18,82,14,104,20,116,26,116,26,110,18,102,22,86],0xee8584);
  rect(20,116,12,12,0xf1b58e); rect(20,116,6,8,0xffd0a3);
  poly([78,74,88,80,98,104,92,122,82,122,78,112,84,102,72,88],OUT);
  poly([80,82,92,104,88,116,84,116,84,110,88,102,76,88],0xcf5d78);
  rect(80,116,12,12,0xe7a487); rect(80,116,6,8,0xffc69a);
  rect(42,46,18,16,OUT); rect(44,48,14,14,0xe2a083);
  // Ponytail silhouette behind the face, with bright ribbon.
  poly([56,8,70,6,82,16,88,38,82,62,72,58,74,38,64,26],OUT);
  poly([66,12,74,14,80,26,80,46,76,54,78,30],0x71423f);
  rect(64,14,10,6,0x67d7c8); rect(68,20,4,8,0xd2fff2);
  face(30,10,0xf6c69c,0xd99078,0x68413f);
  poly([34,12,40,8,58,8,66,16,60,20,50,14,42,24,34,24],0x57353a);
  rect(44,48,12,2,0xac4a65); rect(56,40,4,2,0xa35765);
  rect(32,36,4,6,0xffd764); rect(66,36,4,6,0xffd764);
  shoes(26,54,192);
  g.generateTexture('customer1',108,220);

  // Customer 03: stocky older lifter, silver moustache and purple track jacket.
  g.clear();
  poly([24,124,82,124,88,148,82,198,56,198,52,160,46,198,20,198,16,154],OUT);
  poly([26,128,50,128,48,158,40,194,24,194,22,152],0x514168);
  poly([54,128,78,128,82,152,76,194,60,194,56,154],0x403956);
  rect(26,144,4,42,0x9b76a2); rect(72,142,4,44,0x7e648e);
  poly([24,58,76,58,92,74,98,116,84,140,22,140,8,116,10,76],OUT);
  poly([26,64,72,64,86,78,92,112,80,134,26,134,14,112,16,80],0x826398);
  poly([26,68,40,64,38,92,30,118,34,130,26,130,16,108,18,82],0xb58db4);
  poly([72,66,86,78,92,112,80,134,70,130,78,112,72,94],0x5c4a7b);
  rect(48,64,4,68,0xf3d9b9); rect(50,64,2,68,0x4e3f62);
  rect(36,100,10,4,0x523d69); rect(58,100,12,4,0x523d69);
  rect(18,78,4,30,0xf3d6c5); rect(82,78,4,30,0xd7aeca);
  poly([14,76,6,88,4,114,12,132,24,132,28,118,22,110,26,86],OUT);
  poly([14,84,10,112,16,124,22,124,22,118,16,108,22,86],0x9c79ac);
  poly([88,76,98,86,104,114,98,132,86,132,80,118,88,108,80,86],OUT);
  poly([90,84,98,112,94,124,88,124,86,118,94,108,84,86],0x6b5586);
  rect(12,124,14,16,0xd6a080); rect(12,124,8,12,0xf2c09b);
  rect(86,124,14,16,0xd6a080); rect(86,124,8,12,0xeebb95);
  rect(36,48,28,18,OUT); rect(40,48,20,14,0xd8a080);
  face(28,8,0xe4b28f,0xbb816e,0x817e93,true);
  rect(42,8,16,4,0xc8bfc6); rect(38,12,20,4,0xa4a0ae);
  // Reading glasses and raised, stubborn brows.
  rect(36,28,12,8,OUT); rect(54,28,12,8,OUT); rect(48,30,6,2,OUT);
  rect(38,30,8,4,0xc5d6cf); rect(56,30,8,4,0xc5d6cf);
  rect(42,30,2,4,0x383249); rect(60,30,2,4,0x383249);
  shoes(22,60,192);
  g.generateTexture('customer2',108,220);
  g.destroy();
}
