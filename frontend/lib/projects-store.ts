"use client"

export type ProjectStage = "concept" | "prototype" | "mvp" | "launched" | "Pre‑seed" | "Seed" | "Angel" | "Series A"

export interface Milestone {
  id: string
  title: string
  amount: string
  status: "Released" | "Pending Verification" | "Active" | "Locked"
  description: string
  submittedDate?: string
  releasedDate?: string
  proofLink?: string
  workSummary?: string
}

export interface Pledge {
  id: string
  founderName: string
  founderAvatar?: string
  amount: number
  date: string
  note?: string
}

export interface CommunityUpdate {
  id: string
  title: string
  content: string
  date: string
}

export interface UnifiedProject {
  id: string
  name: string
  title: string // for ideas compatibility
  author: string
  authorAvatar?: string
  authorHeadline?: string
  stage: ProjectStage
  domains: string[] // tags for Projects
  tags: string[]    // tags for Ideas
  desc: string      // short description
  description: string // full description
  communityTarget: number
  communityRaised: number
  investmentNeeded: number
  fundsGained: number
  fundsSpent: number
  milestones: Milestone[]
  likes: number
  commentsCount: number
  views: number
  location: string
  trustPoints: number
  launchedAt?: string | null
  pledges?: Pledge[]
  communityUpdates?: CommunityUpdate[]
  founders: { id: string; name: string; role: string; bio?: string }[]
  uploads: { type: "deck" | "link" | "image"; label: string; href?: string; src?: string }[]
  attachments?: { name: string; size: string; type: string }[]
  flagged?: boolean
  flagReason?: string
}

const INITIAL_PROJECTS: UnifiedProject[] = [
  {
    id: "p1",
    name: "Edge Vision Kit",
    title: "Edge Vision Kit",
    author: "Ava D.",
    authorHeadline: "Hardware Tech Lead",
    stage: "Seed",
    domains: ["Edge AI", "Robotics", "Hardware"],
    tags: ["Edge AI", "Robotics", "Hardware"],
    desc: "Low‑power on‑device vision kit with local models. Shipping v0 sensors.",
    description: "Low‑power on‑device vision kit with local models. Shipping v0 sensors to early adopters. This system enables real-time computer vision processing without cloud dependency, perfect for robotics and IoT applications.",
    communityTarget: 25000,
    communityRaised: 8000,
    investmentNeeded: 18000,
    fundsGained: 12000,
    fundsSpent: 5000,
    location: "SF Bay",
    trustPoints: 82,
    launchedAt: "2026-06-23",
    pledges: [
      { id: "pl-1", founderName: "Lee K.", amount: 2000, date: "2026-07-01", note: "Excited for the open-source hardware approach!" },
      { id: "pl-2", founderName: "Sam P.", amount: 5000, date: "2026-07-03", note: "Pledging for early local sync capabilities." },
      { id: "pl-3", founderName: "Zara Y.", amount: 1000, date: "2026-07-08", note: "Clean system specs Ava, let's collaborate on sensor mesh integrations!" }
    ],
    communityUpdates: [
      { id: "upd-1", title: "Beta Sensor Manufacturing Order", content: "Successfully placed the manufacturing request for the v0.2 hardware sensor boards. Expecting telemetry verification samples within 14 days.", date: "2026-07-05" }
    ],
    milestones: [
      {
        id: "m1",
        title: "Milestone 1: Whitepaper & Architecture Specs",
        amount: "$40,000",
        status: "Released",
        description: "Publish the core decentralization design draft, API specs, and system engineering schemas.",
        releasedDate: "2026-05-15",
        proofLink: "https://github.com/something/docs/whitepaper.md",
        workSummary: "Finalized whitepaper specs and local-first architecture details with team and advisory board approval.",
      },
      {
        id: "m2",
        title: "Milestone 2: Alpha Application & Sync Engine",
        amount: "$40,000",
        status: "Pending Verification",
        description: "Launch prototype workspace featuring local-first SQLite nodes syncing peer-to-peer.",
        submittedDate: "2026-06-18",
        proofLink: "https://alpha.something.dev",
        workSummary: "Sync engine prototype is live. Tested peer synchronization with 5 concurrent active nodes.",
      },
      {
        id: "m3",
        title: "Milestone 3: Security Audit & Public Beta",
        amount: "$40,000",
        status: "Active",
        description: "Conduct smart contract security audits, launch public landing sandbox, onboard 100 beta testing founders.",
      },
      {
        id: "m4",
        title: "Milestone 4: Mainnet Launch & Public APIs",
        amount: "$80,000",
        status: "Locked",
        description: "Deploy stable production release on decentralized nodes and publish public developer documentation.",
      },
    ],
    likes: 24,
    commentsCount: 8,
    views: 156,
    founders: [
      { id: "f-ava", name: "Ava D.", role: "Founder, Hardware", bio: "Former Hardware Lead at Robotics Lab." },
      { id: "f-ian", name: "Ian R.", role: "ML/Edge", bio: "ML Engineer focusing on edge optimization." },
    ],
    uploads: [
      { type: "deck", label: "Pitch Deck.pdf", href: "#" },
      { type: "link", label: "Website", href: "#" },
      { type: "image", label: "Sensor Module", src: "/sensor-module.png" },
    ],
    attachments: [
      { name: "edge_vision_pitch.mp4", size: "24.2 MB", type: "video" },
      { name: "edge_vision_deck.pdf", size: "4.8 MB", type: "presentation" }
    ]
  },
  {
    id: "p2",
    name: "Climate Hardware v1",
    title: "Climate Hardware v1",
    author: "Lee K.",
    authorHeadline: "Climate Systems Engineer",
    stage: "Pre‑seed",
    domains: ["Climate hardware"],
    tags: ["Climate hardware"],
    desc: "Modular carbon capture component; open test data with independent validation.",
    description: "Modular carbon capture component; open test data with independent validation. Designed for low-cost localized installation in industrial areas.",
    communityTarget: 50000,
    communityRaised: 12000,
    investmentNeeded: 40000,
    fundsGained: 15000,
    fundsSpent: 3000,
    location: "Berlin",
    trustPoints: 74,
    launchedAt: "2026-03-15",
    pledges: [
      { id: "pl-4", founderName: "Ava D.", amount: 8000, date: "2026-07-02", note: "Super important climate hardware research. Keep it up!" },
      { id: "pl-5", founderName: "Hugo M.", amount: 4000, date: "2026-07-09", note: "Open test data is the right move." }
    ],
    communityUpdates: [],
    milestones: [
      {
        id: "m1",
        title: "Milestone 1: Prototype Core Specs",
        amount: "$15,000",
        status: "Released",
        description: "Release initial specifications and modular diagrams.",
        releasedDate: "2026-06-01",
        proofLink: "https://climate.something.dev/specs",
        workSummary: "Designed modular structural specifications.",
      },
      {
        id: "m2",
        title: "Milestone 2: Independent Labs Test",
        amount: "$25,000",
        status: "Active",
        description: "Submit carbon capture modules to third-party lab verification.",
      }
    ],
    likes: 18,
    commentsCount: 12,
    views: 89,
    founders: [{ id: "f-lee", name: "Lee K.", role: "Founder", bio: "Dedicated to open-source climate tech." }],
    uploads: [
      { type: "deck", label: "Intro Deck.pdf", href: "#" },
      { type: "link", label: "Data Room", href: "#" },
    ]
  },
  {
    id: "p3",
    name: "Local‑first Creator Analytics",
    title: "Local‑first Creator Analytics",
    author: "Sam P.",
    authorHeadline: "Creator Analytics Architect",
    stage: "Angel",
    domains: ["Creator infra", "Local‑first", "Privacy"],
    tags: ["Creator infra", "Local‑first", "Privacy"],
    desc: "Privacy‑first analytics with CRDT sync across devices.",
    description: "Privacy‑first analytics with CRDT sync across devices. No data leaves your control. Built for creators who want to understand their audience without compromising privacy.",
    communityTarget: 12000,
    communityRaised: 4400,
    investmentNeeded: 12000,
    fundsGained: 8000,
    fundsSpent: 2000,
    location: "Remote",
    trustPoints: 65,
    launchedAt: "2026-07-03",
    pledges: [
      { id: "pl-6", founderName: "Lee K.", amount: 4400, date: "2026-07-10", note: "CRDT sync is the future. Backing immediately." }
    ],
    communityUpdates: [],
    milestones: [
      {
        id: "m1",
        title: "Milestone 1: CRDT Local Sync",
        amount: "$8,000",
        status: "Released",
        description: "Implement zero-server peer data synchronization.",
        releasedDate: "2026-06-10"
      },
      {
        id: "m2",
        title: "Milestone 2: Analytics UI Dashboard",
        amount: "$4,000",
        status: "Active",
        description: "Deploy visual charting components for creators."
      }
    ],
    likes: 18,
    commentsCount: 12,
    views: 89,
    founders: [{ id: "f-sam", name: "Sam P.", role: "Founder & Creator", bio: "Indie hacker focusing on local-first tools." }],
    uploads: [
      { type: "deck", label: "Creator Analytics.pdf", href: "#" },
      { type: "link", label: "GitHub Repo", href: "#" },
    ]
  },
  {
    id: "p4",
    name: "Neurotech IDE",
    title: "Neurotech IDE",
    author: "Sam K.",
    authorHeadline: "Bio-interface Developer",
    stage: "Pre‑seed",
    domains: ["Bio tooling", "Privacy", "Dev tools"],
    tags: ["Bio tooling", "Privacy", "Dev tools"],
    desc: "Local‑only IDE and toolchain for neural interfaces.",
    description: "Local‑only IDE and toolchain for neural interfaces. Privacy‑first development environment for developers working on next-gen brain-computer interfaces.",
    communityTarget: 30000,
    communityRaised: 15000,
    investmentNeeded: 25000,
    fundsGained: 10000,
    fundsSpent: 1000,
    location: "London",
    trustPoints: 58,
    launchedAt: null,
    pledges: [
      { id: "pl-7", founderName: "Ava D.", amount: 10000, date: "2026-07-06", note: "EEG telemetry signal streaming is an insane idea Sam!" },
      { id: "pl-8", founderName: "Zara Y.", amount: 5000, date: "2026-07-11", note: "Pledging for the dev tools side of Neuro IDE." }
    ],
    communityUpdates: [],
    milestones: [
      {
        id: "m1",
        title: "Milestone 1: Local IDE Engine",
        amount: "$10,000",
        status: "Released",
        description: "Deliver neuro-telemetry decoding editor package.",
        releasedDate: "2026-06-05"
      },
      {
        id: "m2",
        title: "Milestone 2: EEG Signals Streaming",
        amount: "$15,000",
        status: "Active",
        description: "Stream BCI telemetry live into the IDE workspace."
      }
    ],
    likes: 42,
    commentsCount: 15,
    views: 234,
    founders: [{ id: "f-hugo", name: "Hugo M.", role: "Neuroengineer", bio: "Pioneering brain-computer software interfaces." }],
    uploads: [
      { type: "deck", label: "Neurotech IDE Brief.pdf", href: "#" },
    ],
    attachments: [
      { name: "neurotech_ide_presentation.pptx", size: "8.1 MB", type: "presentation" },
      { name: "neurotech_podcast_brief.mp3", size: "12.4 MB", type: "audio" },
      { name: "neurotech_whitepaper.pdf", size: "1.2 MB", type: "document" }
    ]
  },
  {
    id: "p5",
    name: "DePIN Sensor Mesh",
    title: "DePIN Sensor Mesh",
    author: "Zara Y.",
    authorHeadline: "Network Systems Engineer",
    stage: "Seed",
    domains: ["DePIN", "Edge AI", "Crypto"],
    tags: ["DePIN", "Edge AI", "Crypto"],
    desc: "Community-powered sensor mesh with provable data lineage.",
    description: "Community-powered sensor mesh with provable data lineage and token incentives. Build local meshes and earn tokens for sharing high-fidelity environmental telemetry.",
    communityTarget: 60000,
    communityRaised: 15000,
    investmentNeeded: 60000,
    fundsGained: 30000,
    fundsSpent: 12000,
    location: "Singapore",
    trustPoints: 88,
    launchedAt: "2025-03-01",
    pledges: [
      { id: "pl-9", founderName: "Sam K.", amount: 5000, date: "2026-07-02", note: "Decentralized mesh networks are critical." },
      { id: "pl-10", founderName: "Lee K.", amount: 10000, date: "2026-07-04", note: "Traction looks strong here. Pledging support." }
    ],
    communityUpdates: [],
    milestones: [
      {
        id: "m1",
        title: "Milestone 1: Node Telemetry Logging",
        amount: "$30,000",
        status: "Released",
        description: "Publish data lineage cryptographic logging module.",
        releasedDate: "2026-06-11"
      },
      {
        id: "m2",
        title: "Milestone 2: Token Incentives",
        amount: "$30,000",
        status: "Active",
        description: "Deploy token distribution smart contract on testnet."
      }
    ],
    likes: 67,
    commentsCount: 23,
    views: 445,
    founders: [
      { id: "f-zara", name: "Zara Y.", role: "Founder, Hardware", bio: "RF engineer & DePIN developer." },
      { id: "f-ken", name: "Kenji S.", role: "Network Protocols", bio: "Ex-protocol architect at decentralized network fund." }
    ],
    uploads: [
      { type: "deck", label: "Mesh Pitch.pdf", href: "#" },
      { type: "link", label: "Explorer Dashboard", href: "#" },
    ]
  }
]

export function getProjects(): UnifiedProject[] {
  if (typeof window === "undefined") return INITIAL_PROJECTS
  const stored = localStorage.getItem("global_projects")
  if (!stored) {
    localStorage.setItem("global_projects", JSON.stringify(INITIAL_PROJECTS))
    return INITIAL_PROJECTS
  }
  try {
    return JSON.parse(stored)
  } catch {
    return INITIAL_PROJECTS
  }
}

export function saveProjects(projects: UnifiedProject[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem("global_projects", JSON.stringify(projects))
    window.dispatchEvent(new CustomEvent("global-projects-updated"))
  }
}

export function getProjectById(id: string): UnifiedProject | undefined {
  const list = getProjects()
  return list.find((p) => p.id === id)
}

export function updateProject(id: string, updated: Partial<UnifiedProject>): UnifiedProject | undefined {
  const list = getProjects()
  const idx = list.findIndex((p) => p.id === id)
  if (idx === -1) return undefined
  
  const updatedProject = {
    ...list[idx],
    ...updated,
    // Sync fields for compatibility
    title: updated.name || list[idx].name,
    name: updated.name || list[idx].name,
    tags: updated.domains || list[idx].domains,
    domains: updated.domains || list[idx].domains,
  }
  list[idx] = updatedProject
  saveProjects(list)
  return updatedProject
}

export function pledgeCommunityFunding(id: string, amount: number, founderName: string = "Founder Partner", note: string = "Backed this idea."): UnifiedProject | undefined {
  const p = getProjectById(id)
  if (!p) return undefined
  
  const newPledge: Pledge = {
    id: `pl-${Date.now()}`,
    founderName,
    amount,
    date: new Date().toISOString().split("T")[0],
    note
  }
  
  const currentPledges = p.pledges || []
  return updateProject(id, {
    communityRaised: p.communityRaised + amount,
    pledges: [newPledge, ...currentPledges]
  })
}

export function commitInvestorFunds(id: string, amount: number): UnifiedProject | undefined {
  const p = getProjectById(id)
  if (!p) return undefined
  return updateProject(id, {
    fundsGained: p.fundsGained + amount
  })
}
