/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * This module enables X11 color name lookups with the help of a perfect hash function
 * to not penalize the package size too much.
 * saving: ~70% (from 17kB down to 5kB)
 */

// Note: module and table data created with fixtures/x11-colornames/create_module.js
const TABLE = 'AB!!!id!jsih!ZYigHp3AkceNiiImVihW3Uih?DFihrenihDEQiwgziieGJvAoMnsidOM3idOtQiciazAsFrtieFZyidKSgAx8odip818ieFiXieF97ic34eihOxpA4UPNidz51A8znjBAX?uBU9ynitOZdigRMNBYgIEBcaXPBk9LVB0xlOB9mcFihmlWCRq0yidmG7idqsHid7RmCV7pCClqRAimG5kCpsb4ipt78CtqLeig17aigJb7ioC4rihzLdigmoNigEDTihzZKCwIz1C4j5sih4QQihlg2igwsHDBFTuDESshDJFzIig1cbihZ3wipZphigiKcihZUxihZLODRm7RilG1Cid3tmDVGffDYJsPDc1JrixgxGidDn3Dli9uDsOl0imDQPiyDhbimDyZihU00icbZSEJs6VieEzpicF2YEqB?PicemNiduxiihEL9ieBjnEuI53icdLPiqBYWiduYFExunsFB3JqFEXPuihnyvFQkNAFVVjlic8SLicIeOFYvurFwrh5icQ4RicHUgidVbJidVA3idN3LGECqgGJiKSGRl8UidT9qipssVGZHNyidy3widTu8idgHsidgcgGdggRGkODXihH!8ilyhpihWj0ihWcailWHjGwO?OilD4BG888ZHJzmGHZtoyicqlkiwWfkicEbdHg3uEHtMkRH0TgkH5MBRIQE9VIUh5VIYeSyieFFgIlC6Qidvc5idv65icprGicNfhItjoJI4N3mJRFpIicLVGJgMY7J2GebKAPoGKyITuidFGWic2olicYLfLFuJDidnoticCc!icx2bieAcuLIv3UicoYuic594LRQ86LZc3NidcphicnOVic09yisjDiitRyFLc7NTicTaFicFbvic6jPLk3JtigqSiL1QJUjJQZpidQvJicUVVidYVsidNOjidNQfidNnLicyCAicHGeidY17icL3cL8DSKMcPzVMgc8dicEg6ig61OMwImmM06KXM6Hl!M96LNicQEbicUjBNAt2Aid4Hwix3w0Ndba5Nt5pqNwuVljBbJaicYjeigAxGN1b!LOEvTnisIIoORf1cOVV!TiczJbiddd5iddgpiclyxidfd8idfuEieACwid?zWih2rlOp2waid?r2OtUKQOxMyjihUpcigKWQO4y32PNAPFidAU6PZAhBPhjAni0PYUiceDridjwXPqEBxPsZ5Cicoi9icBWoieHXOP0B?9QF50CigWlyQJBkUQMs8nici3YQQ?MXidedxicjVCidhu9icqIFidhZjidhBQid0avicmIYQZLp!QdLBNQwFKyipSwfikPB5Q1SZKipSC1idL08Q44Vaic4tpikVWWQ9x5KikK4sig4Afit?bgihvhKRA?wsidxIfidGjgikw?ORRruoRYQWbRh2dkRk!EPRo!Vpig!taR92Glicf4gicxZGSCIB1jED6KSF0tyid0MUieEUnidLfYSRRoKSUk5sSczRfih06gSkpOgikVvGio5X1icp8Kio5NFik0sjix9EQSp8Pvide28icanaidyPpidekWSx71CTANkkicssXTE1nojEbGQTJp32ic?fFTcYU6icuDuicNCIT1B67T4DhEice8dihBd7ismVIUIRe3UVJeiUZBPEVNXn3idXcIj0jici5yT6VgGbJVlXA2idcRxicfAXicT4kicRjbVpnXZieEm?V4feMigLlzV95OGip4?git4nTWF3csicyWQWJGH2ikH?FWMo06ieCn5WSC2fieDOsWUm1Tidor2WZoaQidoCjicz5cWlxroicTKOW4dS9ido5CidnBwic0AWXJX4lXNdDaicS!nXkWPBXotnyYAgsNicrXhicnmHidHe0idHlLicaNvicG8Jida06YMOfFidTV!icY0YidDcrYRiXUYZivaigDO8ig8GPigGNwi88iCikuzkiharXicoAoihJPbihae9ihJmOihJ9xigV9UiwsMyidaEBichf!ic9ZEYk9oiigCARY9kLuidkWPidknpidk?aihh0likBkKZEJFsidjdfieJmgZIU5dieH47isgQIZNxb3ZQn7hidI6HZVIi0il9ZLix9nYih92!ihCeNZZClyZhISFi1IDjid6bQicwQvZl66Eid6riZoGjRicpYuieBC5ic5jfZwlrsicKATimA?cZ8ZO6icxGJieAt2iculVaA40zidYsAacin?aglNzalwMVi9d0mictfZascgqicbxMbABJ?ignSAjYM8?bIhNZigd1qig7eVieJNPbQq8pikKkaigVPligW!fjgR?5bWCHKidCM1bcrI5idppfidpRsi5P6TbkXgIbo2xucEAZdihvCiidPJXidPYxicAACcIXb9isr67cMtDzcgfiVctsKmc8khZigZjTilrC1ihpKGjQhh5dJr30igymSjKJehihMVeig3VrigwENipRc!idKnBdRRFodhKEOdxEc9idEnCidE8zic!9VidK1md18eZit!FHieGkhicJ8SieCXticlSNidbjridA7YeIdgneNtbMeVlKqeZlSZicbpmixtEVesAlzfU2dAfdwW?fsSYbf5w59gB1xOicMKxgN1q8icZbagZPjpidSoWid1Y0ic2JSid1Bhgo7qeidcLjilYKFiw6S2isa5Jgxwl9g00UbicSMohA73XhELGKhUQqNi8cGshgsaridfCIhkkePhtUeth0vCqileCnit5YaiE?plieHKPiJTPmiN7Kt';
const COLORS = '??r6!Pj?!Pj?9fX19fX13Nzc??rw??rw?fXm?fXm!vDm!uvX!uvX?!?V?!?V?!vN?!vN?!TE?9q5?9q5?96t?96t?!S1??jc???w??rN??rN??Xu8P?w9f?69f?68P??8Pj?8Pj?5ub6??D1??D1?!Th?!Th????AAAAL09PL09PL09PL09PaWlpaWlpaWlpaWlpcICQcICQcICQcICQd4iZd4iZd4iZd4iZvr6!vr6!09PT09PT09PT09PTGRlwGRlwAACAAACAAACAZJXtZJXtSD2LSD2LalrNalrNe2jue2juhHD?hHD?AADNAADNQWnhQWnhAAD?HpD?HpD?AL??AL??h87rh87rh876h876RoK0RoK0sMTesMTerdjmrdjmsODmsODmr!7ur!7uAM7RAM7RSNHMSNHMQODQAP??4P??4P??X56gX56gZs2qZs2qf??UAGQAAGQAVWsvVWsvj7yPj7yPLotXLotXPLNxPLNxILKqILKqmPuYmPuYAP9?AP9?fPwAfPwAAP8Af?8AAPqaAPqarf8vrf8vMs0yMs0yms0yms0yIosiIosia44ja44jvbdrvbdr8OaM7uiq7uiq!vrS!vrS???g???g??8A?9cA7t2C7t2C2qUguIYLuIYLvI!PvI!PzVxczVxci0UTi0UToFItzYU?3riH9fXc9d6z9KRg9KRg0rSM0mkesiIipSoq6ZZ66ZZ6!oBy?6B6?6B6?6UA?4wA?4wA?39Q8ICA8ICA?2NH?0UA?0UA?wAA?2m0?2m0?xST?xST?8DL?7bB?7bB23CT23CTsDBgxxWFxxWF0CCQ0CCQ?wD?7oLu3aDd2nDWulXTulXTmTLMmTLMlADTlADTiiviiivioCDwk3Dbk3Db2L?Y??r67unpzcnJi4mJ??Xu7uXezcW?i4aC?!?b7t?MzcCwi4N4?!TE7tW3zbeei31r?9q57sutza!Vi3dl?96t7s!hzbOLi3le??rN7um?zcmli4lw??jc7ujNzcixi4h4???w7u7gzc3Bi4uD8P?w4O7gwc3Bg4uD??D17uDlzcHFi4OG?!Th7tXSzbe1i3178P??4O7uwc3Ng4uLg2??emfuaVnNRzyLSHb?Q27uOl?NJ0CLAAD?AADuAADNAACLHpD?HIbuGHTNEE6LY7j?XKzuT5TNNmSLAL??ALLuAJrNAGiLh87?fsDubKbNSnCLsOL?pNPujbbNYHuLxuL?udPun7bNbHuLyuH?vNLuorXNbnuLv!??st?umsDNaIOL4P??0e7utM3NeouLu???ru7uls3NZouLmPX?juXuesXNU4aLAPX?AOXuAMXNAIaLAP??AO7uAM3NAIuLl???je7uec3NUouLf??Udu7GZs2qRYt0wf?BtO60m82baYtpVP!fTu6UQ82ALotXmv!akO6QfM18VItUAP9?AO52AM1mAItFAP8AAO4AAM0AAIsAf?8Adu4AZs0ARYsAwP8!s!46ms0yaYsiyv9wvO5oos1abos9??aP7uaFzcZzi4ZO?!yL7tyCzb5wi4FM???g7u7Rzc20i4t6??8A7u4Azc0Ai4sA?9cA7skAza0Ai3UA?8El7rQizZsdi2kU?7kP7q0OzZUMi2UI?8HB7rS0zZubi2lp?2pq7mNjzVVVizo6?4JH7nlCzWg5i0cm?9Ob7sWRzap9i3NV?!e67tiuzbqWi35m?6VP7ppJzYU?i1or?38k7nYhzWYdi0UT?zAw7iwszSYmixoa?0BA7js7zTMziyMj?4xp7oJizXBUi0w5?6B67pVyzYFii1dC?6UA7poAzYUAi1oA?38A7nYAzWYAi0UA?3JW7mpQzVtFiz4v?2NH7lxCzU85izYm?0UA7kAAzTcAiyUA?wAA7gAAzQAAiwAA1wdR?xST7hKJzRB2iwpQ?2607mqnzWCQizpi?7XF7qm4zZGei2Ns?6657qKtzYyVi19l?4Kr7nmfzWiJi0dd?zSz7jCnzSmQixxi?z6W7jqMzTJ4iyJS?wD?7gDuzQDNiwCL?4P67nrpzWnJi0eJ?7v?7q7uzZbNi2aL4Gb?0V?utFLNejeLvz7?sjrumjLNaCKLmzD?kSzufSbNVRqLq4L?n3nuiWjNXUeL?!H?7tLuzbXNi3uLqampqampqampqampAACLAACLAIuLAIuLiwCLiwCLiwAAiwAAkO6QkO6Q';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?';
const OFFSET = 551;
const LENGTH = 551;
const BUCKET_LENGTH = TABLE.length / LENGTH;

// match greyXX|grayXX names
const rexGrey = /^gr[ae]y(\d+)/;
// name match
const rexName = /^\w?[A-Za-z0-9 ]+\w/;

function gray(n: number): [number, number, number] | undefined {
  if (0 <= n && n <= 100) {
    const v = Math.floor((n * 256 - n + 50) / 100);
    return [v, v, v];
  }
  return;
}

function hash(d: number, name: string): number {
  if (!d) d = 0x01000193;
  for (const c of name) {
    d = ((d * 0x01000193) ^ c.charCodeAt(0)) & 0xffffffff;
  }
  return d >>> 0;
}

function crc10(name: string, crc?: number): number {
  if (!crc) crc = 0;
  for (const c of name) {
    crc ^= c.charCodeAt(0) << 2;
    for (let k = 0; k < 8; k++) {
      crc = crc & 0x200 ? (crc << 1) ^ 0x233 : crc << 1;
    }
  }
  crc &= 0x3ff;
  return crc >>> 0;
}

function loadData(idx: number): [number, number, number] {
  let value = 0;
  for (let i = idx * BUCKET_LENGTH; i < idx * BUCKET_LENGTH + BUCKET_LENGTH; ++i) {
    value *= ALPHABET.length;
    value += ALPHABET.indexOf(TABLE[i]);
  }
  return [value >>> 20, (value >> 10) & 0x3FF, value & 0x3FF];
}

function loadColor(idx: number): [number, number, number] {
  // color buckets are hardcoded to 4 chars
  let v = 0;
  for (let i = idx * 4; i < idx * 4 + 4; ++i) {
    v *= ALPHABET.length;
    v += ALPHABET.indexOf(COLORS[i]);
  }
  return [v >>> 16, (v >> 8) & 0xFF, v & 0xFF];
}

function lookupIdx(name: string): number {
  let b = loadData(hash(0, name) % LENGTH);
  b = loadData(b[0] < OFFSET ? (-(b[0] - OFFSET) - 1) : hash(b[0] - OFFSET, name) % LENGTH);
  const [ , , crc] = loadData(b[1]);
  return crc10(name) === crc ? b[1] : -1;
}

export function getColorFromName(name: string): [number, number, number] | undefined {
  // basic name filtering
  if (name.length < 3 || name.length > 22 || !rexName.exec(name)) return;

  // handle grays special
  const m = rexGrey.exec(name);
  if (m) return gray(parseInt(m[1]));

  // grab crc checked idx from PHF
  const idx = lookupIdx(name);
  if (idx === -1) return;
  return loadColor(idx);
}
