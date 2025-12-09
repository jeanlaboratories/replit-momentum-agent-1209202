
import type { User, Campaign, Sponsorship, SponsorshipInvitation, BrandMember, BrandInvitation, UserProfilePreferences } from "@/lib/types";
import type { UnifiedMedia } from "@/lib/types/media-library";

// --- Users ---
export const users: User[] = [
    // Hope Harbor
    {
        uid: "harbor-director-01",
        email: "director@hopeharbor.org",
        displayName: "Director",
        photoURL: "https://i.pravatar.cc/150?u=director@hopeharbor.org",
        brandId: "hope-harbor",
    },
    {
        uid: "harbor-volunteer-01",
        email: "tom@hopeharbor.org",
        displayName: "Tom Volunteer",
        photoURL: "https://i.pravatar.cc/150?u=tom@hopeharbor.org",
        brandId: "hope-harbor",
    },
    // Quantum Bio
    {
        uid: "quantum-pi-01",
        email: "dr.chen@quantumbio.res",
        displayName: "Dr. Chen",
        photoURL: "https://i.pravatar.cc/150?u=dr.chen@quantumbio.res",
        brandId: "quantum-bio",
    },
    {
        uid: "quantum-researcher-01",
        email: "emma@quantumbio.res",
        displayName: "Emma Researcher",
        photoURL: "https://i.pravatar.cc/150?u=emma@quantumbio.res",
        brandId: "quantum-bio",
    },
    // Spectrum Creative
    {
        uid: "spectrum-director-01",
        email: "maya@spectrumcreative.com",
        displayName: "Maya Director",
        photoURL: "https://i.pravatar.cc/150?u=maya@spectrumcreative.com",
        brandId: "spectrum-creative",
    },
    {
        uid: "spectrum-designer-01",
        email: "jordan@spectrumcreative.com",
        displayName: "Jordan Designer",
        photoURL: "https://i.pravatar.cc/150?u=jordan@spectrumcreative.com",
        brandId: "spectrum-creative",
    },
    // Nova Labs
    {
        uid: "nova-pm-01",
        email: "sarah@novalabs.io",
        displayName: "Sarah PM",
        photoURL: "https://i.pravatar.cc/150?u=sarah@novalabs.io",
        brandId: "nova-labs",
    },
    {
        uid: "nova-eng-01",
        email: "james@novalabs.io",
        displayName: "James Engineer",
        photoURL: "https://i.pravatar.cc/150?u=james@novalabs.io",
        brandId: "nova-labs",
    },
    // Lightning FC
    {
        uid: "lightning-coach-01",
        email: "coach@lightningfc.team",
        displayName: "Coach",
        photoURL: "https://i.pravatar.cc/150?u=coach@lightningfc.team",
        brandId: "lightning-fc",
    },
    {
        uid: "lightning-coordinator-01",
        email: "alex@lightningfc.team",
        displayName: "Alex Coordinator",
        photoURL: "https://i.pravatar.cc/150?u=alex@lightningfc.team",
        brandId: "lightning-fc",
    }
];

// --- Campaigns ---
export const campaigns: Campaign[] = [
    {
        id: "campaign-01",
        brandId: "advantage-digital",
        name: "Summer Sale 2024",
        createdBy: "creator-user-01",
        createdAt: new Date().toISOString(),
        content: [
            {
                day: 1,
                contentBlocks: [
                    {
                        contentType: "Social Media Post",
                        adCopy: "Our summer sale is here! Get up to 50% off on all items.",
                        imagePrompt: "A bright and sunny beach scene with people enjoying our products.",
                        imageUrl: "https://picsum.photos/seed/summer-sale/600/400",
                    },
                    {
                        contentType: "Email Newsletter",
                        adCopy: "Don't miss out on our biggest summer sale ever! Click here to shop now.",
                        imagePrompt: "A vibrant graphic with bold text saying 'Summer Sale 50% OFF'.",
                        imageUrl: "https://picsum.photos/seed/summer-email/600/400",
                    }
                ]
            },
            {
                day: 2,
                contentBlocks: [
                    {
                        contentType: "Blog Post Idea",
                        adCopy: "Top 5 Summer Essentials You Need Now",
                        imagePrompt: "A flat lay of summer-themed products like sunglasses, sunscreen, and a beach towel.",
                        imageUrl: "https://picsum.photos/seed/summer-blog/600/400",
                    }
                ]
            }
        ]
    }
];

// --- Brand Members ---
export const brandMembers: BrandMember[] = [
    // Hope Harbor Members
    {
        id: "hope-harbor_harbor-director-01",
        brandId: "hope-harbor",
        userId: "harbor-director-01",
        userEmail: "director@hopeharbor.org",
        userDisplayName: "Director",
        userPhotoURL: "https://i.pravatar.cc/150?u=director@hopeharbor.org",
        role: "MANAGER",
        status: "ACTIVE",
        createdAt: "2024-01-15T08:00:00Z",
        updatedAt: "2024-01-15T08:00:00Z"
    },
    {
        id: "hope-harbor_harbor-volunteer-01",
        brandId: "hope-harbor",
        userId: "harbor-volunteer-01",
        userEmail: "tom@hopeharbor.org",
        userDisplayName: "Tom Volunteer",
        userPhotoURL: "https://i.pravatar.cc/150?u=tom@hopeharbor.org",
        role: "CONTRIBUTOR",
        status: "ACTIVE",
        invitedBy: "harbor-director-01",
        createdAt: "2024-01-16T09:00:00Z",
        updatedAt: "2024-01-16T09:00:00Z"
    },
    // Quantum Bio Members
    {
        id: "quantum-bio_quantum-pi-01",
        brandId: "quantum-bio",
        userId: "quantum-pi-01",
        userEmail: "dr.chen@quantumbio.res",
        userDisplayName: "Dr. Chen",
        userPhotoURL: "https://i.pravatar.cc/150?u=dr.chen@quantumbio.res",
        role: "MANAGER",
        status: "ACTIVE",
        createdAt: "2024-02-01T08:00:00Z",
        updatedAt: "2024-02-01T08:00:00Z"
    },
    {
        id: "quantum-bio_quantum-researcher-01",
        brandId: "quantum-bio",
        userId: "quantum-researcher-01",
        userEmail: "emma@quantumbio.res",
        userDisplayName: "Emma Researcher",
        userPhotoURL: "https://i.pravatar.cc/150?u=emma@quantumbio.res",
        role: "CONTRIBUTOR",
        status: "ACTIVE",
        invitedBy: "quantum-pi-01",
        createdAt: "2024-02-02T10:00:00Z",
        updatedAt: "2024-02-02T10:00:00Z"
    }
];

// --- Sponsorships ---
export const sponsorships: Sponsorship[] = [
    {
        id: "techforward-sponsor_greenleaf-sponsored",
        sponsorBrandId: "techforward-sponsor",
        sponsoredBrandId: "greenleaf-sponsored", 
        sponsorBrandName: "TechForward Solutions",
        sponsoredBrandName: "GreenLeaf Organics",
        status: "ACTIVE",
        initiatedBy: "sponsor-manager-01",
        approvedBy: "sponsored-manager-01",
        createdAt: "2024-03-01T10:00:00Z",
        approvedAt: "2024-03-05T14:30:00Z",
        metadata: {
            note: "Partnership for sustainable technology solutions in organic farming.",
            permissions: {
                canViewBrandProfile: true,
                canViewUploads: true
            }
        }
    },
    {
        id: "techforward-sponsor_advantage-digital",
        sponsorBrandId: "techforward-sponsor",
        sponsoredBrandId: "advantage-digital",
        sponsorBrandName: "TechForward Solutions", 
        sponsoredBrandName: "AdVantage Digital",
        status: "PENDING",
        initiatedBy: "sponsor-manager-01",
        createdAt: "2024-03-10T11:00:00Z",
        metadata: {
            note: "Exploring partnership for AI-powered marketing solutions.",
            permissions: {
                canViewBrandProfile: true,
                canViewUploads: true
            }
        }
    }
];

// --- Sponsorship Invitations ---
export const sponsorshipInvitations: SponsorshipInvitation[] = [
    {
        id: "techforward-sponsor_admin@advantage.app",
        sponsorBrandId: "techforward-sponsor",
        sponsorBrandName: "TechForward Solutions",
        managerEmail: "admin@advantage.app",
        targetBrandId: "advantage-digital",
        targetBrandName: "AdVantage Digital",
        token: "sponsor-invite-token-001",
        status: "PENDING",
        initiatedBy: "sponsor-manager-01",
        initiatedByName: "Sarah Martinez",
        createdAt: "2024-03-10T11:00:00Z",
        expiresAt: "2024-03-17T11:00:00Z",
        note: "We'd like to sponsor your team to showcase our AI technology solutions alongside your marketing expertise."
    }
];

// --- Brand Invitations ---
export const brandInvitations: BrandInvitation[] = [
    // Example pending invitation
    {
        id: "advantage-digital_pending@example.com",
        brandId: "advantage-digital",
        email: "pending@example.com",
        displayName: "Pending User",
        role: "CONTRIBUTOR",
        token: "brand-invite-token-001",
        status: "PENDING",
        invitedBy: "admin-user-01",
        createdAt: "2024-03-12T09:00:00Z",
        expiresAt: "2024-03-19T09:00:00Z"
    }
];

// --- User Profile Preferences ---
export const userProfilePreferences: UserProfilePreferences[] = [
    {
        userId: "admin-user-01",
        brandId: "advantage-digital",
        bannerImageUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800",
        logoUrl: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200",
        brandText: {
            coreText: {
                missionVision: "Admin's Vision: To revolutionize digital marketing through AI-powered innovation and data-driven strategies.",
                brandStory: "Admin's Story: Founded by marketing veterans who saw the need for smarter, more efficient campaign management.",
                taglines: [
                    "Admin's Tagline: Marketing Made Intelligent",
                    "Your AI Marketing Partner",
                    "Data Drives Results"
                ]
            },
            marketingText: {
                adCopy: [
                    "Admin's Copy: Transform your marketing with AI",
                    "Get 50% more engagement with AdVantage",
                    "Smart campaigns that deliver results"
                ],
                productDescriptions: [
                    "AI-powered campaign generation platform",
                    "Multi-channel marketing automation"
                ],
                emailCampaigns: [
                    "Welcome to the future of marketing",
                    "See how AI can transform your campaigns"
                ],
                landingPageCopy: "Admin's Landing: Discover the power of AI-driven marketing campaigns that convert."
            },
            contentMarketingText: {
                blogPosts: [
                    "5 Ways AI is Changing Digital Marketing",
                    "The Future of Campaign Management"
                ],
                socialMediaCaptions: [
                    "Admin's Social: Elevate your marketing game with AI",
                    "Smart campaigns start here"
                ],
                whitePapers: [
                    "The ROI of AI in Marketing: A Comprehensive Study"
                ],
                videoScripts: [
                    "Introduction to AdVantage AI Platform"
                ]
            },
            technicalSupportText: {
                userManuals: "Admin's Manual: Comprehensive guide to using the AdVantage platform",
                faqs: [
                    {
                        question: "How does AI improve my campaigns?",
                        answer: "Our AI analyzes your brand and generates optimized content for maximum engagement."
                    }
                ]
            },
            publicRelationsText: {
                pressReleases: [
                    "AdVantage AI Launches Revolutionary Marketing Platform"
                ],
                companyStatements: [
                    "We're committed to making AI accessible to all marketers"
                ],
                mediaKitText: "Admin's Media Kit: Learn about AdVantage AI and our mission to transform digital marketing."
            }
        },
        updatedAt: "2024-03-15T10:00:00Z"
    },
    {
        userId: "creator-user-01",
        brandId: "advantage-digital",
        bannerImageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800",
        logoUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200",
        brandText: {
            coreText: {
                missionVision: "Creator's Vision: Empowering businesses with cutting-edge AI tools for seamless campaign creation.",
                brandStory: "Creator's Story: Built by creators, for creators who understand the challenges of modern marketing.",
                taglines: [
                    "Creator's Tagline: Create. Automate. Succeed.",
                    "AI-Powered Campaign Excellence",
                    "Marketing Simplified"
                ]
            },
            marketingText: {
                adCopy: [
                    "Creator's Copy: Launch campaigns in minutes, not days",
                    "AI-generated content that resonates",
                    "Boost your brand with smart automation"
                ],
                productDescriptions: [
                    "Next-gen marketing automation platform",
                    "Complete campaign lifecycle management"
                ],
                emailCampaigns: [
                    "Join thousands of successful marketers",
                    "Start your free trial today"
                ],
                landingPageCopy: "Creator's Landing: Build powerful marketing campaigns with AI assistance every step of the way."
            },
            contentMarketingText: {
                blogPosts: [
                    "10 Tips for Better Campaign Performance",
                    "How to Leverage AI in Your Marketing Strategy"
                ],
                socialMediaCaptions: [
                    "Creator's Social: Unlock your marketing potential",
                    "Create campaigns that captivate"
                ],
                whitePapers: [
                    "Marketing Automation Best Practices 2024"
                ],
                videoScripts: [
                    "Getting Started with AdVantage: A Quick Guide"
                ]
            },
            technicalSupportText: {
                userManuals: "Creator's Manual: Step-by-step guide to campaign creation and management",
                faqs: [
                    {
                        question: "Can I customize AI-generated content?",
                        answer: "Absolutely! All AI-generated content is fully editable to match your brand voice."
                    }
                ]
            },
            publicRelationsText: {
                pressReleases: [
                    "AdVantage AI Reaches 10,000 Active Users Milestone"
                ],
                companyStatements: [
                    "Innovation and user success drive everything we do"
                ],
                mediaKitText: "Creator's Media Kit: Discover how AdVantage AI is transforming the marketing landscape."
            }
        },
        updatedAt: "2024-03-16T14:30:00Z"
    }
];

// --- Media Items ---
export const mockMedia: UnifiedMedia[] = [
    {
        id: "media-01",
        brandId: "advantage-digital",
        type: "image",
        url: "https://picsum.photos/seed/media-01/600/400",
        title: "Summer Sale Banner",
        tags: ["summer", "sale"],
        collections: [],
        source: "upload",
        createdAt: "2024-06-01T10:00:00Z",
        createdBy: "admin-user-01",
        uploadedBy: "admin-user-01",
        isPublished: true,
        auditTrail: [
            {
                userId: "admin-user-01",
                action: "created",
                timestamp: "2024-06-01T10:00:00Z",
                details: "Uploaded via dashboard"
            },
            {
                userId: "admin-user-01",
                action: "published",
                timestamp: "2024-06-01T10:05:00Z"
            }
        ]
    },
    {
        id: "media-02",
        brandId: "advantage-digital",
        type: "image",
        url: "https://picsum.photos/seed/media-02/600/400",
        title: "Private Campaign Asset",
        tags: ["internal", "draft"],
        collections: [],
        source: "ai-generated",
        createdAt: "2024-06-02T14:00:00Z",
        createdBy: "creator-user-01",
        generatedBy: "creator-user-01",
        isPublished: false,
        auditTrail: [
            {
                userId: "creator-user-01",
                action: "created",
                timestamp: "2024-06-02T14:00:00Z",
                details: "Generated via AI"
            }
        ]
    },
    {
        id: "media-03",
        brandId: "advantage-digital",
        type: "video",
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        title: "Product Demo",
        tags: ["demo", "product"],
        collections: [],
        source: "upload",
        createdAt: "2024-06-03T09:00:00Z",
        createdBy: "admin-user-01",
        uploadedBy: "admin-user-01",
        isPublished: true,
        auditTrail: [
            {
                userId: "admin-user-01",
                action: "created",
                timestamp: "2024-06-03T09:00:00Z",
                details: "Uploaded via dashboard"
            },
            {
                userId: "creator-user-01",
                action: "tagged",
                timestamp: "2024-06-03T10:00:00Z",
                details: "Added tags: demo, product"
            },
            {
                userId: "admin-user-01",
                action: "published",
                timestamp: "2024-06-03T11:00:00Z"
            }
        ]
    }
];
