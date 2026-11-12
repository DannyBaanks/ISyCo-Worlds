package mx.isyco.munder.mobile.ui

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.graphics.graphicsLayer
import kotlinx.coroutines.delay
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.Normalizer
import mx.isyco.munder.mobile.Agent
import mx.isyco.munder.mobile.R
import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * El look de la app, de src/renderer/src/design/tokens.css: los colores --cth
 * en claro y oscuro, Press Start 2P para etiquetas en versalitas, esquinas
 * cuadradas, líneas de 1 px, sombra dura y los retratos pixel del elenco
 * (generados por avatar-engine.cjs vía scripts/make-assets.cjs).
 *
 * Espejo de App/Pixel.swift.
 */

object Px {
    @Composable fun cream50() = dyn(0xFFFDF5, 0x17171B, 0xEEF7E2, 0x0E1A26)
    @Composable fun cream100() = dyn(0xFFF8E7, 0x1D1D22, 0xE4F1D6, 0x132331)
    @Composable fun cream200() = dyn(0xF4E9C7, 0x26262C, 0xDCECC8, 0x1B3042)
    @Composable fun cream300() = dyn(0xE8D9A0, 0x313139, 0xC3DBA8, 0x26425A)
    @Composable fun paper100() = dyn(0xFCFAF0, 0x1A1A1F, 0xFCFFF8, 0x11202D)
    @Composable fun ink900() = dyn(0x1A1320, 0xDEDBD6, 0x1C2B3A, 0xE8F3E6)
    @Composable fun ink700() = dyn(0x3D2E4A, 0xB3B0AC, 0x33475C, 0xC2D3C8)
    @Composable fun ink500() = dyn(0x6B5878, 0x96919F, 0x536779, 0x9DB0AB)
    @Composable fun ink300() = dyn(0xA899B5, 0x787684, 0x7D92A4, 0x6F8792)
    @Composable fun ink100() = dyn(0xD9CFE0, 0x3E3D46, 0xCBD8E0, 0x2B4257)
    @Composable fun coral() = dyn(0xD96A62, 0xE08C82, 0xD9472F, 0xF0806C)
    @Composable fun coralLight() = dyn(0xF3D3CD, 0x3B2724, 0xFBD9D0, 0x47241F)
    @Composable fun mint() = dyn(0x5CA97A, 0x74C096, 0x3F9A4B, 0x7FD08A)
    @Composable fun lemon() = dyn(0xDCAB3C, 0xCFAA57, 0xFFCF3F, 0xFFD866)
    @Composable fun lemonLight() = dyn(0xF3E4BC, 0x332C1D, 0xFFF1C2, 0x40371A)
    @Composable fun sky() = dyn(0x4F9FAF, 0x6FB3C4, 0x2F8FC4, 0x74C0EA)
    @Composable fun idle() = dyn(0xA199AB, 0x6F6C77, 0x7D92A4, 0x6F8792)
    val onAccent = Color(0xFF1A1320)
    /** Contorno grueso de Monster Village; en la oficina es la línea de tinta de siempre. */
    @Composable fun outline() = dyn(0xA899B5, 0x787684, 0x0B1A28, 0x050D15)
    /** El bisel nocturno de Monster Village (barra de pestañas). */
    @Composable fun night() = dyn(0xFCFAF0, 0x1A1A1F, 0x17324A, 0x0F2436)
    @Composable fun berryDark() = dyn(0x6B5878, 0x96919F, 0x7A2318, 0x7A2318)
    @Composable fun shadow() =
        if (Skin.monster) outline()
        else if (isSystemInDarkTheme()) Color.Black.copy(alpha = 0.45f)
        else Color(0xFF1A1320).copy(alpha = 0.14f)

    @Composable
    private fun dyn(light: Long, dark: Long, monsterLight: Long, monsterDark: Long): Color {
        val isDark = isSystemInDarkTheme()
        val hex = if (Skin.monster) (if (isDark) monsterDark else monsterLight) else (if (isDark) dark else light)
        return Color(hex or 0xFF000000)
    }
}

/**
 * El mundo de la oficina emparejada decide el look, el elenco y cómo se llama
 * el jefe. Lo manda la oficina en `overview.office.world`; mientras no llega,
 * la app se ve como Munder. Es estado de Compose: al cambiar, todo se redibuja.
 *
 * Espejo de `Skin` en App/Pixel.swift.
 */
object Skin {
    var world by mutableStateOf("office")
    val monster: Boolean get() = world == "monster-trainer"
    val boss: String get() = if (monster) "Profesor" else "Michael"
    val place: String get() = if (monster) "Pueblo" else "Oficina"

    /** Esquinas: cuadradas en la oficina, redondeadas en Monster Village. */
    fun shape(radius: Int = 14): Shape = if (monster) RoundedCornerShape(radius.dp) else RectangleShape
    fun dot(): Shape = if (monster) CircleShape else RectangleShape
}

/**
 * Movimiento de Monster Village: las superficies entran con un saltito, lo que
 * se toca cede bajo el dedo, los retratos se mecen. La oficina se queda quieta.
 */
@Composable
fun Modifier.popIn(delayMs: Int = 0): Modifier {
    if (!Skin.monster) return this
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (delayMs > 0) delay(delayMs.toLong())
        shown = true
    }
    val progress by animateFloatAsState(
        targetValue = if (shown) 1f else 0f,
        animationSpec = spring(dampingRatio = 0.62f, stiffness = Spring.StiffnessMediumLow),
        label = "popIn",
    )
    return this.graphicsLayer {
        alpha = progress.coerceIn(0f, 1f)
        scaleX = 0.92f + 0.08f * progress
        scaleY = 0.92f + 0.08f * progress
        translationY = (1f - progress) * 24f
    }
}

/** Respuesta al toque: se encoge un poco mientras está presionado. */
@Composable
fun Modifier.pressable(source: MutableInteractionSource): Modifier {
    if (!Skin.monster) return this
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.95f else 1f,
        animationSpec = spring(dampingRatio = 0.5f, stiffness = Spring.StiffnessMedium),
        label = "press",
    )
    return this.graphicsLayer { scaleX = scale; scaleY = scale }
}

/** Fondo y borde de una superficie con la forma del mundo activo. */
@Composable
fun Modifier.frame(fill: Color, line: Color, width: Dp = 1.dp, radius: Int = 14): Modifier {
    val shape = Skin.shape(radius)
    val w = if (Skin.monster && width < 2.dp) 2.dp else width
    return this.background(fill, shape).border(w, line, shape)
}

val PixelFont: FontFamily = try {
    FontFamily(Font(R.font.press_start_2p))
} catch (e: Exception) {
    FontFamily.Monospace
}

/** Press Start 2P no trae mayúsculas acentuadas: las etiquetas pierden el acento, el cuerpo lo guarda. */
fun pixelCaps(s: String): String {
    val flat = Normalizer.normalize(s, Normalizer.Form.NFD).replace("\\p{Mn}+".toRegex(), "")
    return flat.uppercase()
}

@Composable
fun PixelLabel(text: String, sizeSp: Int = 8, color: Color = Px.ink500()) {
    Text(
        text = pixelCaps(text),
        fontFamily = PixelFont,
        fontSize = sizeSp.sp,
        lineHeight = (sizeSp + sizeSp / 2).sp,
        color = color,
    )
}

@Composable
fun PixelCard(
    fill: Color = Px.paper100(),
    border: Color = Px.ink300(),
    content: @Composable () -> Unit,
) {
    val shape = Skin.shape(16)
    Box(
        modifier = Modifier
            .popIn()
            .background(Px.shadow(), shape)
            .padding(start = 0.dp, top = 0.dp, end = if (Skin.monster) 0.dp else 3.dp, bottom = if (Skin.monster) 4.dp else 3.dp),
    ) {
        Box(
            modifier = Modifier
                .background(fill, shape)
                .border(if (Skin.monster) 3.dp else 1.dp, if (Skin.monster) Px.outline() else border, shape)
                .padding(14.dp),
        ) { content() }
    }
}

enum class PixelKind { PRIMARY, GHOST, DANGER }

@Composable
fun PixelButton(
    text: String,
    kind: PixelKind = PixelKind.PRIMARY,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    val monster = Skin.monster
    val shape = Skin.shape(50)
    val fill = when {
        !enabled -> Px.cream300()
        kind == PixelKind.PRIMARY -> if (monster) Px.coral() else Px.ink900()
        kind == PixelKind.DANGER -> if (monster) Px.paper100() else Px.coral()
        else -> if (monster) Px.paper100() else Px.cream100()
    }
    val fg = when {
        !enabled -> Px.ink500()
        kind == PixelKind.PRIMARY -> if (monster) Color.White else Px.cream50()
        kind == PixelKind.DANGER -> if (monster) Px.coral() else Px.onAccent
        else -> Px.ink900()
    }
    val border = when {
        monster && kind == PixelKind.PRIMARY -> Px.berryDark()
        monster && kind == PixelKind.DANGER -> Px.coral()
        monster -> Px.outline()
        kind == PixelKind.PRIMARY -> Px.ink900()
        else -> Px.ink300()
    }
    val edge = when {
        monster && kind == PixelKind.GHOST -> Px.outline()
        monster -> Px.berryDark()
        kind == PixelKind.PRIMARY -> Px.ink500()
        else -> Px.ink100()
    }
    val source = remember { MutableInteractionSource() }
    Box(
        modifier = Modifier
            .pressable(source)
            .background(edge, shape)
            .padding(start = 0.dp, top = 0.dp, end = 0.dp, bottom = if (monster) 4.dp else 2.dp),
    ) {
        Box(
            modifier = Modifier
                .background(fill, shape)
                .border(if (monster) 2.dp else 1.dp, border, shape)
                .clickable(interactionSource = source, indication = LocalIndication.current, enabled = enabled) { onClick() }
                .padding(vertical = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(text, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = fg)
        }
    }
}

@Composable
fun Modifier.pixelField(): Modifier =
    this.frame(Px.paper100(), Px.ink300(), 1.dp, radius = 12)

@Composable
fun PixelTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String = "",
    singleLine: Boolean = true,
) {
    Box(modifier = Modifier.pixelField().padding(10.dp)) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = singleLine,
            textStyle = TextStyle(color = Px.ink900(), fontSize = 14.sp),
            decorationBox = { inner ->
                if (value.isEmpty()) Text(placeholder, color = Px.ink300(), fontSize = 14.sp)
                inner()
            },
        )
    }
}

@Composable
fun PixelEditor(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String = "",
) {
    Box(modifier = Modifier.pixelField().padding(10.dp).heightIn(min = 84.dp)) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = TextStyle(color = Px.ink900(), fontSize = 14.sp),
            decorationBox = { inner ->
                if (value.isEmpty()) Text(placeholder, color = Px.ink300(), fontSize = 14.sp)
                inner()
            },
        )
    }
}

@Composable
fun StatusDot(color: Color, pulse: Boolean = false) {
    // En Monster Village el punto late mientras el agente trabaja o está atorado.
    val beat = if (pulse && Skin.monster) {
        rememberInfiniteTransition(label = "dot").animateFloat(
            initialValue = 1f,
            targetValue = 1.45f,
            animationSpec = infiniteRepeatable(tween(750, easing = FastOutSlowInEasing), RepeatMode.Reverse),
            label = "dotScale",
        )
    } else {
        null
    }
    Box(
        modifier = Modifier
            .size(8.dp)
            .graphicsLayer { val s = beat?.value ?: 1f; scaleX = s; scaleY = s }
            .background(color, Skin.dot()),
    )
}

@Composable
fun Chip(text: String, fill: Color = Px.cream200(), dot: Color? = null, pulse: Boolean = false) {
    Row(
        modifier = Modifier.background(fill, Skin.shape(50)).border(1.dp, Px.ink100(), Skin.shape(50)).padding(horizontal = if (Skin.monster) 8.dp else 6.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (dot != null) {
            StatusDot(dot, pulse)
            androidx.compose.foundation.layout.Spacer(modifier = Modifier.size(6.dp))
        }
        PixelLabel(text, sizeSp = 7, color = Px.ink700())
    }
}

@Composable
fun Bubble(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier.frame(if (Skin.monster) Px.paper100() else Px.cream50(), if (Skin.monster) Px.outline() else Px.ink900(), if (Skin.monster) 3.dp else 2.dp).padding(12.dp),
    ) { content() }
}

// ── el elenco ──

object Cast {
    /** Misma regla que la PWA: el jefe es Michael, si no el nombre o id, si no un fijo estable. */
    val monsters = listOf("agua", "fuego", "electricidad", "oscuridad", "luz", "aire")

    /** Elenco de Monster Village: el Profesor coordina; cada worker conserva su monstruo. */
    fun monster(who: String): String {
        if (who == "michael" || who == "profesor") return "profesor"
        if (monsters.contains(who)) return who
        var h = 0L
        for (ch in who) h = (h * 31 + ch.code) and 0xFFFFFFFFL
        return monsters[(h % monsters.size).toInt()]
    }

    fun of(id: String, name: String, god: Boolean, names: List<String>): String {
        if (Skin.monster) {
            if (god) return "profesor"
            val named = name.lowercase()
            return if (monsters.contains(named)) named else monster(id)
        }
        if (god) return "michael"
        for (raw in listOf(name, id)) {
            var key = raw.lowercase()
            if (key.startsWith("worker-")) key = key.removePrefix("worker-")
            key = key.takeWhile { it.isLetter() && it in 'a'..'z' }
            if (names.contains(key)) return key
        }
        val pool = names.filter { it != "michael" }
        if (pool.isEmpty()) return "michael"
        var h = 0L
        for (ch in id) h = (h * 31 + ch.code) and 0xFFFFFFFFL
        return pool[(h % pool.size).toInt()]
    }

    fun of(agent: Agent?, names: List<String>): String {
        if (agent == null) return "michael"
        return of(agent.id, agent.name, agent.god == true, names)
    }

    fun forAssignee(id: String?, agents: List<Agent>?, names: List<String>): String {
        if (id == null) return "michael"
        val a = agents?.firstOrNull { it.id == id || it.name.lowercase() == id.lowercase() }
        if (a != null) return of(a, names)
        return of(id, id, false, names)
    }
}

@Composable
fun rememberCastNames(): List<String> {
    val ctx = LocalContext.current
    return remember {
        try {
            ctx.assets.list("Media/Cast")?.map { it.removeSuffix(".png") }?.sorted() ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }
}

@Composable
fun Portrait(name: String, scale: Float = 2f) {
    val ctx = LocalContext.current
    val monster = Skin.monster
    val file = if (monster) "Media/Monsters/${Cast.monster(name)}.png" else "Media/Cast/$name.png"
    val bmp = remember(file) {
        try {
            ctx.assets.open(file).use { BitmapFactory.decodeStream(it) }
        } catch (e: Exception) {
            null
        }
    }
    // El elenco de la oficina es 18×28; los monstruos son cuadrados.
    val w = ((if (monster) 26 else 18) * scale).dp
    val h = ((if (monster) 26 else 28) * scale).dp
    val shape = Skin.shape(12)
    val bob = if (monster) {
        rememberInfiniteTransition(label = "portrait").animateFloat(
            initialValue = 0f,
            targetValue = -3f,
            animationSpec = infiniteRepeatable(tween(1500, easing = FastOutSlowInEasing), RepeatMode.Reverse),
            label = "portraitBob",
        )
    } else {
        null
    }
    val tile = Modifier.graphicsLayer { translationY = (bob?.value ?: 0f) * density }.size(w, h).background(Px.cream200(), shape).border(if (monster) 2.dp else 1.dp, if (monster) Px.outline() else Px.ink100(), shape)
    if (bmp != null) {
        Image(
            painter = BitmapPainter(bmp.asImageBitmap()),
            contentDescription = name,
            modifier = tile,
            contentScale = ContentScale.FillBounds,
        )
    } else {
        Box(modifier = tile)
    }
}

// ── iconos pixel 12×12, mismas cuadrículas que la PWA ──

object PixelIcon {
    val office = listOf("....####....", "...#....#...", "..#......#..", ".#........#.", "############", "#..........#", "#.##....##.#", "#.##....##.#", "#..........#", "#....##....#", "#....##....#", "############")
    val ask = listOf("...######...", "..##....##..", "..##....##..", "........##..", ".......##...", "......##....", ".....##.....", ".....##.....", "............", ".....##.....", ".....##.....", "............")
    val board = listOf("############", "#..........#", "#.##.##.##.#", "#.##.##.##.#", "#..........#", "#.##.##....#", "#.##.##....#", "#..........#", "############", ".#........#.", ".#........#.", "............")
    val link = listOf("............", ".####.......", "#....#......", "#..#####....", "#....#..#...", ".####....#..", "..#....####.", "...#..#....#", "....#####..#", "......#....#", ".......####.", "............")
    val panel = listOf("############", "#..........#", "#.##....##.#", "#.##....##.#", "#..........#", "#.###..###.#", "#..........#", "#..........#", "#.##....##.#", "#..........#", "#..........#", "############")

    @Composable
    fun Draw(grid: List<String>, cell: Dp = 2.dp, tint: Color = Px.ink900()) {
        Canvas(modifier = Modifier.size((12 * 2).dp)) {
            val px = cell.toPx()
            grid.forEachIndexed { y, row ->
                row.forEachIndexed { x, ch ->
                    if (ch == '#') drawRect(tint, Offset(x * px, y * px), Size(px, px))
                }
            }
        }
    }
}

// ── ayuditas ──

object When {
    fun ago(iso: String?): String? {
        if (iso == null) return null
        val date = try {
            Instant.from(DateTimeFormatter.ISO_DATE_TIME.parse(iso))
        } catch (e: Exception) {
            try {
                Instant.from(DateTimeFormatter.ISO_INSTANT.parse(iso))
            } catch (e2: Exception) {
                return null
            }
        }
        val m = ((Instant.now().epochSecond - date.epochSecond) / 60).toInt()
        if (m < 1) return "ahora"
        if (m < 60) return "hace $m min"
        val h = m / 60
        if (h < 24) return "hace $h h"
        return "hace ${h / 24} d"
    }
}

val stateName: Map<String, String> = mapOf("idle" to "libre", "working" to "trabajando", "blocked" to "bloqueado", "gone" to "fuera", "offline" to "apagado")

@Composable
fun stateColor(s: String?): Color = when (s) {
    "idle" -> Px.mint()
    "working" -> Px.lemon()
    "blocked" -> Px.coral()
    else -> Px.idle()
}
