extends Node2D
# Emberwake Godot önizlemesi: Rust çekirdeğinden oda alır, 2.5D (eğik izdüşüm) çizer.
# Tuşlar: WASD/oklar hareket, R yeni oda, 1-4 oda türü (savaş, elit, boss, pazar).

const TW := 21.0
const TH := 14.0
const DUVAR_Y := 17.0
const ORIGIN := Vector2(10, 40)
const SCALE := 2.0

const RENK := {
	0: Color("3a3550"), 1: Color("1d1a2b"), 3: Color("0a0814"), 4: Color("5b5470"),
	5: Color("6b6585"), 6: Color("8a7a4a"), 7: Color("4a3f2a"), 9: Color("2a2640"),
	10: Color("b04a4a"), 11: Color("e0652a"),
}

var cekirdek
var grid: PackedByteArray
var w := 22
var h := 14
var tohum := 1
var tur := "savas"
var derinlik := 3
var oyuncu := Vector2(11, 11.4)
var dalga_metin := ""

func _ready() -> void:
	if not ClassDB.class_exists("EmberCore"):
		push_error("EmberCore yok: Rust uzantısı yüklenmedi (cargo build, sonra emberwake.gdextension yolunu kontrol et).")
		return
	cekirdek = ClassDB.instantiate("EmberCore")
	w = cekirdek.genislik()
	h = cekirdek.yukseklik()
	yeni_oda()

func yeni_oda() -> void:
	grid = cekirdek.oda(tohum, tur, derinlik)
	dalga_metin = cekirdek.dalgalar(tohum, tur, derinlik)
	oyuncu = Vector2(11, 11.4)
	queue_redraw()

func _process(dt: float) -> void:
	if cekirdek == null:
		return
	var d := Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down"))
	if d != Vector2.ZERO:
		var yeni := oyuncu + d.normalized() * 4.0 * dt
		if gecilir(yeni):
			oyuncu = yeni
		queue_redraw()

func _unhandled_key_input(e: InputEvent) -> void:
	if cekirdek == null or not e.pressed:
		return
	match e.keycode:
		KEY_R: tohum += 1
		KEY_1: tur = "savas"
		KEY_2: tur = "elit"
		KEY_3: tur = "boss"; derinlik = 4
		KEY_4: tur = "pazar"
		_: return
	yeni_oda()

func hucre(x: int, y: int) -> int:
	if x < 0 or y < 0 or x >= w or y >= h:
		return 1
	return grid[y * w + x]

func gecilir(p: Vector2) -> bool:
	var t := hucre(int(floor(p.x)), int(floor(p.y)))
	return t == 0 or t == 6 or t == 7 or t == 9 or t == 10 or t == 11

func proj(x: float, y: float) -> Vector2:
	return (ORIGIN + Vector2(x * TW, y * TH)) * SCALE / SCALE

func _draw() -> void:
	if cekirdek == null:
		return
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(SCALE, SCALE))
	for y in range(h):
		for x in range(w):
			var t := hucre(x, y)
			var p := proj(x, y)
			var renk: Color = RENK.get(t, Color.MAGENTA)
			if t == 1 or t == 5 or t == 4:
				draw_rect(Rect2(p + Vector2(0, -DUVAR_Y), Vector2(TW, DUVAR_Y)), renk.darkened(0.35))
				draw_rect(Rect2(p + Vector2(0, -DUVAR_Y), Vector2(TW, 4)), renk.lightened(0.15))
			else:
				draw_rect(Rect2(p, Vector2(TW, TH)), renk)
	var o := proj(oyuncu.x, oyuncu.y)
	draw_circle(o + Vector2(0, -6), 5, Color("ffb35a"))
	draw_string(ThemeDB.fallback_font, Vector2(8, 14), "%s  tohum=%d  derinlik=%d  | %s" % [tur, tohum, derinlik, dalga_metin], HORIZONTAL_ALIGNMENT_LEFT, -1, 8)
