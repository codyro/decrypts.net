// Progressive-enhancement scroll reveal for the landing sections.
//
// Elements marked with `data-reveal` fade in, rise ~12px and scale from 0.98
// to 1 the first time they scroll into view. The hidden initial state is only
// activated by adding the `reveal` class to the root, which happens here only
// when IntersectionObserver exists and the user allows motion — without JS
// (or under `prefers-reduced-motion: reduce`) the content stays fully visible.
// One shared observer watches every target; each target reveals once and never
// re-animates. Per-element stagger comes from the `--reveal-delay` custom
// property set inline by the components.
import { onBeforeUnmount, onMounted, ref } from 'vue'

let sharedObserver: IntersectionObserver | null = null

const getObserver = () => {
    if (sharedObserver !== null) return sharedObserver
    sharedObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue
            entry.target.classList.add('reveal-visible')
            sharedObserver?.unobserve(entry.target)
        }
    }, { threshold: 0.15 })
    return sharedObserver
}

export const useReveal = () => {
    const root = ref<HTMLElement | null>(null)
    let observer: IntersectionObserver | null = null

    onMounted(() => {
        const el = root.value
        if (!el || typeof IntersectionObserver === 'undefined') return
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
        const targets = el.querySelectorAll('[data-reveal]')
        if (targets.length === 0) return
        el.classList.add('reveal')
        observer = getObserver()
        targets.forEach((target) => observer?.observe(target))
    })

    onBeforeUnmount(() => {
        if (!observer) return
        const targets = root.value?.querySelectorAll('[data-reveal]') ?? []
        targets.forEach((target) => observer?.unobserve(target))
    })

    return root
}
