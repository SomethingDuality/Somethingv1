import { cn } from "@/lib/utils"

/*
 * The Something creature, traced from public/ththingwhite.png (the landing's mascot) at 98.7 percent
 * pixel overlap: about 1.6 KB of paths instead of a 1.37 MB PNG. Coordinates are the original
 * 1024px artwork's; the eye is a hole (even-odd), so it shows whatever is behind the creature.
 * It is the interior's one bold element (chat/frontend_brief.md, Part 4 "Signature").
 */
const BODY = "M240 666 L239 655 L244 644 L250 638 L250 636 L268 617 L270 617 L277 609 L279 609 L295 594 L302 590 L307 584 L306 501 L310 441 L312 433 L319 421 L328 413 L346 403 L386 389 L425 380 L482 372 L514 371 L525 373 L531 376 L534 380 L534 386 L531 389 L465 397 L406 410 L381 418 L361 427 L353 434 L353 440 L367 449 L398 460 L431 468 L465 473 L513 473 L555 468 L594 460 L603 460 L607 463 L609 468 L609 525 L615 532 L625 530 L641 521 L659 505 L659 503 L668 493 L674 481 L678 466 L678 449 L676 440 L677 426 L681 416 L688 407 L702 399 L720 398 L736 405 L745 416 L750 435 L750 459 L744 492 L731 523 L729 524 L728 528 L726 529 L725 533 L720 538 L718 543 L707 555 L708 627 L705 661 L700 680 L694 692 L682 704 L669 711 L649 718 L639 758 L632 769 L619 779 L608 782 L593 782 L577 776 L570 770 L570 768 L566 764 L558 738 L555 736 L544 736 L522 739 L477 741 L472 746 L470 757 L465 769 L455 780 L451 781 L448 784 L437 787 L422 787 L410 784 L399 778 L387 764 L381 749 L375 724 L371 721 L364 720 L352 714 L349 714 L338 707 L324 691 L318 675 L265 677 L250 674 L243 670Z M452 551 L444 560 L441 570 L442 581 L446 589 L452 595 L466 600 L475 599 L485 594 L491 587 L494 579 L494 568 L489 557 L481 550 L472 547 L462 547Z"
const GIFT = "M564 332 L570 318 L615 273 L627 267 L642 267 L653 273 L686 307 L688 307 L697 316 L697 318 L702 322 L705 330 L705 342 L700 352 L653 399 L646 403 L636 405 L629 404 L620 400 L569 350 L565 342Z"
const SPARKS = ["M673 217 L680 217 L686 223 L686 253 L683 257 L678 259 L671 257 L668 253 L668 222Z", "M736 235 L740 240 L739 248 L719 268 L709 268 L705 263 L706 255 L726 235Z", "M721 298 L721 292 L726 286 L756 286 L761 291 L761 298 L756 303 L726 303Z"]

type Props = {
  size?: number
  /** Holding the diamond up: "something" is here for you. */
  holding?: boolean
  /** Change this number to play the pop once (the diamond rises out of the lid). 0 = no animation. */
  pop?: number
  className?: string
  /** Makes the drawing labelled; without it the creature is decorative (aria-hidden). */
  title?: string
}

export function Creature({ size = 24, holding = false, pop = 0, className, title }: Props) {
  return (
    <svg
      viewBox="200 200 600 600"
      width={size}
      height={size}
      fill="currentColor"
      fillRule="evenodd"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={BODY} />
      {holding && (
        // key={pop} remounts the group so the animation plays again for each new pop
        <g key={pop} className={pop > 0 ? "creature-pop" : undefined}>
          <path d={GIFT} />
          <g className={pop > 0 ? "creature-spark" : undefined}>
            {SPARKS.map((d) => <path key={d} d={d} />)}
          </g>
        </g>
      )}
    </svg>
  )
}
