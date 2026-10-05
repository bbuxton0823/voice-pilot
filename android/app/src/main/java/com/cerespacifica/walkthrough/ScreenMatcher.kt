package com.cerespacifica.walkthrough

/**
 * Ranks the labels on whatever screen is open against what the inspector said.
 * Pure Kotlin, so it is unit tested on a computer. Same ideas as Voice Pilot's web
 * matcher: ignore words every option shares, count each word once, treat filler
 * words ("not", "will") as weak, and understand everyday and HQS-era wording.
 */
data class ScreenTarget(val id: Int, val label: String, val kind: String = "button")

data class Ranked(val target: ScreenTarget, val score: Double)

sealed class MatchResult {
    data class Sure(val target: ScreenTarget, val score: Double) : MatchResult()
    data class Ambiguous(val options: List<ScreenTarget>) : MatchResult()
    data class Blocked(val target: ScreenTarget) : MatchResult()
    object NoMatch : MatchResult()
}

object ScreenMatcher {
    /** Actions the pilot never takes for you: saving, submitting, signing, deleting. */
    private val BLOCKED = Regex(
        "\\b(save|submit|sign|signature|finish|finalize|complete inspection|close inspection|delete|remove inspection|" +
            "send|sync|upload|approve|certify|log ?out|sign ?out|pay|purchase)\\b", RegexOption.IGNORE_CASE)

    private val STOP = setOf("the", "a", "an", "is", "are", "in", "on", "of", "and", "to", "it", "its", "this", "that",
        "there", "at", "for", "with", "by", "be", "has", "have", "was", "when", "tap", "press", "click", "select", "mark")
    private val WEAK = setOf("not", "will", "does", "cannot", "no", "or")

    private val SYNONYMS: Map<String, List<String>> = mapOf(
        "missing" to listOf("not", "installed", "missing", "absent"),
        "none" to listOf("not", "installed"),
        "no" to listOf("missing", "not"),
        "dead" to listOf("not", "produce", "inoperable", "function", "energized"),
        "inoperable" to listOf("inoperable", "not", "function", "produce"),
        "working" to listOf("function", "functioning", "operate", "produce", "inoperable"),
        "work" to listOf("function", "functioning", "operate", "produce", "inoperable"),
        "broken" to listOf("broken", "damaged", "inoperable"),
        "damaged" to listOf("damaged", "broken"),
        "blocked" to listOf("obstructed", "blocked"),
        "covered" to listOf("obstructed"),
        "cracked" to listOf("cracked", "damaged", "broken"),
        "hole" to listOf("hole", "holes", "damaged"),
        "loose" to listOf("loose", "secured", "damaged"),
        "wobbly" to listOf("secured", "loose"),
        "leaking" to listOf("leak", "leaking"),
        "leak" to listOf("leak", "leaking"),
        "peeling" to listOf("peeling", "deteriorated"),
        "doesn't" to listOf("not", "does", "inoperable"),
        "won't" to listOf("not", "will", "inoperable"),
        "can't" to listOf("cannot", "not"),
        "trip" to listOf("test", "reset", "button", "inoperable"),
        "lock" to listOf("secured", "secure", "lock"),
        "roach" to listOf("cockroach", "cockroaches"),
        "roaches" to listOf("cockroach", "cockroaches"),
        "mice" to listOf("mice", "mouse"),
        "rats" to listOf("rat", "rats"),
        "clogged" to listOf("inoperable", "draining", "drain"),
        "smoke" to listOf("smoke", "alarm", "detector"),
        "detector" to listOf("detector", "alarm"),
        "fridge" to listOf("refrigerator"),
        "stove" to listOf("range", "cooktop", "oven", "cooking"),
        "tpr" to listOf("relief", "valve", "discharge"),
        "commode" to listOf("toilet"),
        "lots" to listOf("extensive"),
    )

    private fun norm(s: String): String =
        s.lowercase().replace('’', '\'').replace(Regex("[^a-z0-9' ]"), " ").replace(Regex("\\s+"), " ").trim()

    private fun words(s: String): List<String> = norm(s).split(' ').filter { it.isNotEmpty() && it !in STOP }

    fun isBlocked(label: String): Boolean = BLOCKED.containsMatchIn(label)

    fun rank(said: String, targets: List<ScreenTarget>): List<Ranked> {
        val t = norm(said)
        if (t.isEmpty() || targets.isEmpty()) return emptyList()
        val spoken = words(t)
        val expanded = HashSet<String>().apply {
            spoken.forEach { w -> add(w); SYNONYMS[w]?.let { addAll(it) } }
            if ("not working" in t || "doesn't work" in t || "does not work" in t) addAll(listOf("inoperable", "function", "produce"))
        }
        val labelWords = targets.map { words(it.label).toSet() }
        val common = if (labelWords.size > 1) labelWords.reduce { a, b -> a intersect b } else emptySet()

        fun score(i: Int, ignore: Set<String>): Double {
            val uniq = labelWords[i] - common - ignore
            val hits = uniq.filter { it in expanded }.sumOf { if (it in WEAK) 0.3 else 1.0 }
            return if (uniq.isEmpty()) 0.0 else hits / Math.sqrt(uniq.size.toDouble())
        }
        fun bonus(i: Int): Double {
            // Saying the label (or most of it) word for word is the strongest signal.
            val l = norm(targets[i].label)
            return if (l.isNotEmpty() && (t.contains(l) || (l.contains(t) && t.length >= 6))) 1.0 else 0.0
        }
        val first = targets.indices.map { score(it, emptySet()) }
        val top = first.maxOrNull() ?: 0.0
        // Words shared by all the close candidates only name the subject ("smoke alarm"),
        // so they can't tell those candidates apart. Score again without them.
        val close = targets.indices.filter { top > 0 && first[it] >= top * 0.5 }
        val subject = if (close.size > 1) close.map { labelWords[it] - common }.reduce { a, b -> a intersect b } else emptySet()
        val second = targets.indices.map { if (subject.isEmpty()) first[it] else score(it, subject) }
        val allZeroInGroup = subject.isNotEmpty() && close.all { second[it] == 0.0 }
        return targets.indices.map { i ->
            val base = when {
                allZeroInGroup && i in close -> 0.5          // equally plausible: let decide() ask
                subject.isNotEmpty() && i in close -> second[i] + 0.5
                else -> second[i]
            }
            Ranked(targets[i], base + bonus(i))
        }.sortedByDescending { it.score }
    }

    /** Sure = clearly best; Ambiguous = two or more close; Blocked = best is a save/submit-type button. */
    fun decide(said: String, targets: List<ScreenTarget>, minScore: Double = 0.45, margin: Double = 0.8): MatchResult {
        val ranked = rank(said, targets).filter { it.score > 0 }
        val top = ranked.firstOrNull() ?: return MatchResult.NoMatch
        if (top.score < minScore) return MatchResult.NoMatch
        val close = ranked.filter { it.score >= top.score * margin }
        if (close.size > 1) return MatchResult.Ambiguous(close.take(4).map { it.target })
        if (isBlocked(top.target.label)) return MatchResult.Blocked(top.target)
        return MatchResult.Sure(top.target, top.score)
    }
}
