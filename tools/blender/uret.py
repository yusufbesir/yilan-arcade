# Yilan Arcade prosedürel PBR doku üreticisi (Blender 4.x, başsız, Cycles CPU).
# Sahip: Claude (Yilan Arcade 0.9.23). Dış varlık yok; her şey Blender düğümleriyle üretilir.
# Kullanım (depo kökünden):
#   blender -b -P tools/blender/uret.py -- <cikti_kok> [kimlik ...] [--onizleme DIZIN]
# Örnek:
#   blender -b -P tools/blender/uret.py -- src/img/tex --onizleme C:\gecici
# Dikişsizlik: UV (u,v) 4B torusa gömülür (cos u, sin u, cos v | W=sin v); Noise/Voronoi 4B çalışır,
# böylece desen u ve v'de tam periyodiktir. Normal ve AO, Blender'ın Cycles ile pişirdiği yükseklikten
# periyodik (np.roll/FFT) hesaplanır; böylece döşemede kenar çizgisi oluşmaz.
# Çıktı: <KIMLIK>_Color / NormalGL / Roughness / AmbientOcclusion .jpg, 512x512.
import bpy, sys, os, math
import numpy as np

TAU = 2.0 * math.pi
RES = 512
SS = 2  # 1024'te pişirip 512'ye indirgenir (kenar yumuşatma)


def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (c[0], c[1], c[2], 1.0)


class NB:
    def __init__(self, nt):
        self.nt = nt
        self._tor = None

    def node(self, t, **props):
        n = self.nt.nodes.new(t)
        for k, v in props.items():
            setattr(n, k, v)
        return n

    def set(self, n, name, v):
        s = n.inputs[name]
        if isinstance(v, bpy.types.NodeSocket):
            self.nt.links.new(v, s)
        elif isinstance(v, (tuple, list)):
            s.default_value = v
        elif v is not None:
            s.default_value = v

    def math(self, op, a, b=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        self.set(n, 0, a)
        if b is not None:
            self.set(n, 1, b)
        return n.outputs[0]

    def rng(self, v, a0, a1, b0=0.0, b1=1.0, interp='SMOOTHSTEP'):
        n = self.node('ShaderNodeMapRange', interpolation_type=interp, clamp=True)
        self.set(n, 'Value', v)
        self.set(n, 'From Min', a0)
        self.set(n, 'From Max', a1)
        self.set(n, 'To Min', b0)
        self.set(n, 'To Max', b1)
        return n.outputs['Result']

    def mix(self, fac, c1, c2, blend='MIX'):
        n = self.node('ShaderNodeMixRGB', blend_type=blend)
        self.set(n, 'Fac', fac)
        self.set(n, 'Color1', c1)
        self.set(n, 'Color2', c2)
        return n.outputs[0]

    def ramp(self, v, stops):
        n = self.node('ShaderNodeValToRGB')
        el = n.color_ramp.elements
        while len(el) < len(stops):
            el.new(0.5)
        for i, (p, c) in enumerate(stops):
            el[i].position = p
            el[i].color = lin(c) if isinstance(c, str) else c
        self.set(n, 'Fac', v)
        return n.outputs['Color']

    def bw(self, c):
        n = self.node('ShaderNodeRGBToBW')
        self.set(n, 0, c)
        return n.outputs[0]

    def torus(self):
        if self._tor:
            return self._tor
        tc = self.node('ShaderNodeTexCoord')
        sp = self.node('ShaderNodeSeparateXYZ')
        self.nt.links.new(tc.outputs['UV'], sp.inputs[0])
        a = self.math('MULTIPLY', sp.outputs['X'], TAU)
        b = self.math('MULTIPLY', sp.outputs['Y'], TAU)
        cm = self.node('ShaderNodeCombineXYZ')
        self.nt.links.new(self.math('COSINE', a), cm.inputs['X'])
        self.nt.links.new(self.math('SINE', a), cm.inputs['Y'])
        self.nt.links.new(self.math('COSINE', b), cm.inputs['Z'])
        self._tor = (cm.outputs[0], self.math('SINE', b), sp.outputs['Y'])
        return self._tor

    def noise(self, cells, detail=4.0, rough=0.55, vec=None, distort=0.0):
        v, w, _ = self.torus()
        n = self.node('ShaderNodeTexNoise', noise_dimensions='4D')
        self.nt.links.new(vec if vec is not None else v, n.inputs['Vector'])
        self.nt.links.new(w, n.inputs['W'])
        n.inputs['Scale'].default_value = cells / TAU
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        n.inputs['Distortion'].default_value = distort
        return n

    def voronoi(self, cells, feature='F1', rand=1.0, vec=None):
        v, w, _ = self.torus()
        n = self.node('ShaderNodeTexVoronoi', voronoi_dimensions='4D', feature=feature)
        self.nt.links.new(vec if vec is not None else v, n.inputs['Vector'])
        self.nt.links.new(w, n.inputs['W'])
        n.inputs['Scale'].default_value = cells / TAU
        n.inputs['Randomness'].default_value = rand
        return n

    def warped(self, cells, amount):
        """Periyodik gürültüyle bozulmuş torus koordinatı (kırık çatlaklar için)."""
        v, _, _ = self.torus()
        nz = self.noise(cells, 3.0, 0.5)
        sub = self.node('ShaderNodeVectorMath', operation='SUBTRACT')
        self.nt.links.new(nz.outputs['Color'], sub.inputs[0])
        sub.inputs[1].default_value = (0.5, 0.5, 0.5)
        sc = self.node('ShaderNodeVectorMath', operation='SCALE')
        self.nt.links.new(sub.outputs[0], sc.inputs[0])
        sc.inputs['Scale'].default_value = amount
        ad = self.node('ShaderNodeVectorMath', operation='ADD')
        self.nt.links.new(v, ad.inputs[0])
        self.nt.links.new(sc.outputs[0], ad.inputs[1])
        return ad.outputs[0]


# ---------------------------------------------------------------- malzemeler
def m_buz(nb):
    """Buz kristali karo: kristal plakalar, donuk derz, iç çatlaklar."""
    cell = nb.voronoi(3.4, 'F1', 0.95)
    cv = nb.bw(cell.outputs['Color'])
    ed = nb.voronoi(3.4, 'DISTANCE_TO_EDGE', 0.95).outputs['Distance']
    ed2 = nb.voronoi(8, 'DISTANCE_TO_EDGE', 1.0).outputs['Distance']
    fine = nb.noise(40, 5.0, 0.5).outputs['Fac']
    soft = nb.noise(5, 3.0, 0.5).outputs['Fac']
    frost = nb.rng(nb.noise(4, 4.0, 0.55).outputs['Fac'], 0.52, 0.72)
    g = nb.rng(ed, 0.0, 0.11)                     # 0 derzde, 1 plakada
    c2 = nb.rng(ed2, 0.0, 0.045, 1.0, 0.0)       # ince iç çatlak
    h = nb.math('ADD', nb.math('MULTIPLY', g, 0.55), 0.12)
    h = nb.math('ADD', h, nb.math('MULTIPLY', cv, 0.2))
    h = nb.math('ADD', h, nb.math('MULTIPLY', fine, 0.05))
    h = nb.math('SUBTRACT', h, nb.math('MULTIPLY', c2, 0.07))
    plate = nb.ramp(nb.math('ADD', nb.math('MULTIPLY', cv, 0.6), nb.math('MULTIPLY', soft, 0.5), clamp=True),
                    [(0.0, '#2c74b4'), (0.5, '#6fb6e4'), (1.0, '#c4e9f9')])
    col = nb.mix(nb.math('MULTIPLY', c2, 0.6), plate, lin('#eaf9ff'))
    col = nb.mix(nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, g), 0.9), col, lin('#d6effa'))
    col = nb.mix(nb.math('MULTIPLY', frost, 0.55), col, lin('#f4fcff'))
    r = nb.math('ADD', 0.10, nb.math('MULTIPLY', soft, 0.14))
    r = nb.math('ADD', r, nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, g), 0.45))
    r = nb.math('ADD', r, nb.math('MULTIPLY', frost, 0.32))
    r = nb.math('ADD', r, nb.math('MULTIPLY', c2, 0.08), clamp=True)
    return {'Color': col, 'Height': h, 'Roughness': r}


def m_lav(nb):
    """Lav bazalt: koyu bazalt plakalar, soğuk lav çatlakları parlak turuncu."""
    wv = nb.warped(3, 0.30)
    cell = nb.voronoi(2.8, 'F1', 1.0, vec=wv)
    cv = nb.bw(cell.outputs['Color'])
    ed = nb.voronoi(2.8, 'DISTANCE_TO_EDGE', 1.0, vec=wv).outputs['Distance']
    ed2 = nb.voronoi(7, 'DISTANCE_TO_EDGE', 1.0, vec=wv).outputs['Distance']
    grain = nb.noise(18, 8.0, 0.6).outputs['Fac']
    soft = nb.noise(4, 4.0, 0.5).outputs['Fac']
    crack = nb.rng(ed, 0.010, 0.040, 1.0, 0.0)
    thin = nb.rng(ed2, 0.0, 0.016, 0.45, 0.0)     # plaka üstünde ince sıcak çizgiler
    halo = nb.rng(ed, 0.02, 0.20, 1.0, 0.0)
    heat = nb.rng(nb.noise(3, 3.0, 0.5).outputs['Fac'], 0.30, 0.80, 0.55, 1.0)
    glow = nb.math('MULTIPLY', nb.math('ADD', crack, thin, clamp=True), heat)
    base = nb.ramp(nb.math('ADD', nb.math('MULTIPLY', grain, 0.7), nb.math('MULTIPLY', cv, 0.3), clamp=True),
                   [(0.0, '#121013'), (0.55, '#27232a'), (1.0, '#3c3238')])
    col = nb.mix(nb.math('MULTIPLY', halo, 0.45), base, lin('#4d1300'))
    lava = nb.ramp(glow, [(0.0, '#5a0c00'), (0.40, '#ff4400'), (0.75, '#ff8c12'), (1.0, '#ffd45a')])
    col = nb.mix(nb.math('MULTIPLY', glow, 1.6, clamp=True), col, lava)
    h = nb.math('ADD', nb.math('MULTIPLY', nb.rng(ed, 0.0, 0.15), 0.78), 0.18)
    h = nb.math('ADD', h, nb.math('MULTIPLY', grain, 0.08))
    h = nb.math('ADD', h, nb.math('MULTIPLY', cv, 0.08))
    r = nb.math('SUBTRACT', 0.86, nb.math('MULTIPLY', grain, 0.14))
    r = nb.math('SUBTRACT', r, nb.math('MULTIPLY', glow, 0.60), clamp=True)
    return {'Color': col, 'Height': h, 'Roughness': r}


def m_deri(p):
    def f(nb):
        wv = nb.warped(3, 0.08)
        cell = nb.voronoi(9, 'F1', 0.85, vec=wv)
        cv = nb.bw(cell.outputs['Color'])
        ed = nb.voronoi(9, 'DISTANCE_TO_EDGE', 0.85, vec=wv).outputs['Distance']
        dome = nb.rng(ed, 0.0, 0.26)
        _, _, vv = nb.torus()
        warp = nb.noise(3, 3.0, 0.5).outputs['Fac']
        ang = nb.math('ADD', nb.math('MULTIPLY', vv, TAU * 2.0), nb.math('MULTIPLY', nb.math('SUBTRACT', warp, 0.5), 5.0))
        band = nb.rng(nb.math('ADD', nb.math('MULTIPLY', nb.math('SINE', ang), 0.5), 0.5), 0.70, 0.95)
        speck = nb.noise(60, 3.0, 0.5).outputs['Fac']
        body = nb.ramp(nb.math('ADD', nb.math('MULTIPLY', cv, 0.75), nb.math('MULTIPLY', speck, 0.25), clamp=True),
                       [(0.0, p['base']), (1.0, p['alt'])])
        col = nb.mix(nb.math('MULTIPLY', band, p['bandw']), body, lin(p['band']))
        shade = nb.math('ADD', 0.62, nb.math('MULTIPLY', dome, 0.38))
        col = nb.mix(1.0, col, nb.ramp(shade, [(0.0, '#000000'), (1.0, '#ffffff')]), blend='MULTIPLY')
        col = nb.mix(nb.rng(ed, 0.0, 0.16, 0.9, 0.0), col, lin(p['edge']))
        h = nb.math('ADD', nb.math('MULTIPLY', dome, 0.8), nb.math('MULTIPLY', cv, 0.08))
        h = nb.math('ADD', h, nb.math('MULTIPLY', speck, 0.03))
        r = nb.math('ADD', p['rough'], nb.math('MULTIPLY', nb.math('SUBTRACT', 1.0, dome), 0.4), clamp=True)
        return {'Color': col, 'Height': h, 'Roughness': r}
    return f


DERI = {
    'YilanDeriNors': dict(base='#1f5a2e', alt='#5f9440', band='#b08a38', bandw=0.45, edge='#0b2414', rough=0.38),
    'YilanDeriKor': dict(base='#8a1409', alt='#e2480e', band='#ffb52e', bandw=0.55, edge='#240504', rough=0.33),
    'YilanDeriBuz': dict(base='#4f9fd8', alt='#d2f0ff', band='#ffffff', bandw=0.50, edge='#1f4f80', rough=0.28),
}
# kimlik -> (kurucu, normal gücü, AO gücü)
MAT = {
    'BuzKristal01': (m_buz, 26.0, 1.6),
    'LavBazalt01': (m_lav, 30.0, 1.8),
}
for k, p in DERI.items():
    MAT[k] = (m_deri(p), 22.0, 1.4)


# ---------------------------------------------------------------- pişirme
def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 1
    sc.cycles.use_denoising = False
    sc.render.bake.margin = 0
    sc.render.bake.use_clear = True
    sc.view_settings.view_transform = 'Raw'
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 90
    sc.render.image_settings.color_mode = 'RGB'
    bpy.ops.mesh.primitive_plane_add(size=2)
    return sc, bpy.context.active_object


def bake(sc, obj, builder):
    mat = bpy.data.materials.new('m')
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    chans = builder(NB(nt))
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    res = {}
    for ch, sock in chans.items():
        img = bpy.data.images.new('bk_' + ch, RES * SS, RES * SS, alpha=False, float_buffer=True)
        img.colorspace_settings.name = 'Non-Color'
        tn = nt.nodes.new('ShaderNodeTexImage')
        tn.image = img
        nt.nodes.active = tn
        tn.select = True
        nt.links.new(sock, em.inputs['Color'])
        bpy.ops.object.bake(type='EMIT', margin=0, use_clear=True)
        a = np.empty(RES * SS * RES * SS * 4, dtype=np.float32)
        img.pixels.foreach_get(a)
        a = a.reshape(RES * SS, RES * SS, 4)[:, :, :3]
        a = a.reshape(RES, SS, RES, SS, 3).mean(axis=(1, 3))
        res[ch] = a
        nt.nodes.remove(tn)
        bpy.data.images.remove(img)
    return res


def blur(a, s):
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2.0 * (np.pi ** 2) * (s ** 2) * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def maps_from(res, nstr, aostr):
    col = np.clip(res['Color'], 0, 1)
    srgb = np.where(col <= 0.0031308, col * 12.92, 1.055 * np.power(np.maximum(col, 1e-9), 1 / 2.4) - 0.055)
    rough = np.clip(res['Roughness'][:, :, 0], 0, 1)
    hgt = res['Height'][:, :, 0]
    hgt = (hgt - hgt.min()) / max(1e-6, hgt.max() - hgt.min())
    dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5
    dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5  # satır 0 = alt (Blender), +Y yukarı
    nx, ny, nz = -dx * nstr, -dy * nstr, np.ones_like(dx)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    nrm = np.stack([nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, nz / l * 0.5 + 0.5], axis=2)
    cav = np.zeros_like(hgt)
    for s, wt in ((3, 0.5), (8, 0.35), (20, 0.25)):
        cav += wt * np.clip(blur(hgt, s) - hgt, 0, None) / (0.08 * (1 + s / 8.0))
    ao = np.clip(1.0 - cav * aostr, 0.0, 1.0)
    ao = 0.25 + 0.75 * ao
    return {
        'Color': srgb,
        'NormalGL': nrm,
        'Roughness': np.repeat(rough[:, :, None], 3, axis=2),
        'AmbientOcclusion': np.repeat(ao[:, :, None], 3, axis=2),
    }


def save(sc, arr, path):
    img = bpy.data.images.new('o', RES, RES, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((RES, RES, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(rgba.ravel())
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save_render(path, scene=sc)
    bpy.data.images.remove(img)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    prev = None
    if '--onizleme' in argv:
        i = argv.index('--onizleme')
        prev = argv[i + 1]
        del argv[i:i + 2]
    kok = argv[0]
    ids = argv[1:] or list(MAT.keys())
    sc, obj = setup()
    for mid in ids:
        builder, ns, aos = MAT[mid]
        res = bake(sc, obj, builder)
        maps = maps_from(res, ns, aos)
        for k, a in maps.items():
            save(sc, a, os.path.join(kok, mid, '%s_%s.jpg' % (mid, k)))
            if prev and k == 'Color':
                big = np.tile(a, (2, 2, 1))  # 2x2 döşeme: dikiş denetimi
                save_big(sc, big, os.path.join(prev, mid + '_2x2.png'))
        print('TAMAM', mid)


def save_big(sc, arr, path):
    h, w = arr.shape[:2]
    img = bpy.data.images.new('b', w, h, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(arr, 0, 1)
    img.pixels.foreach_set(rgba.ravel())
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sc.render.image_settings.file_format = 'PNG'
    img.save_render(path, scene=sc)
    sc.render.image_settings.file_format = 'JPEG'
    bpy.data.images.remove(img)


main()
