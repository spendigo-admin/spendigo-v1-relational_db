export interface Job {
    id: string | number;
    title: string;
    location: string;
    team: string;
    type: string;
    description: string;
    requirements: string[];
    responsibilities?: string[];
    isVisible?: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export const values = [
    {
        icon: '🚀',
        title: 'Innovation First',
        description: 'We push the boundaries of AI to simplify shopping for everyone, everywhere.'
    },
    {
        icon: '🤝',
        title: 'Collaboration',
        description: 'We believe the best ideas come from diverse perspectives and working together.'
    },
    {
        icon: '💎',
        title: 'Quality & Integrity',
        description: 'We are committed to delivering the highest standards of code and service.'
    },
    {
        icon: '🌍',
        title: 'Global Impact',
        description: 'Our goal is to help millions of families save money and time through technology.'
    }
];

export const benefits = [
    {
        icon: '🏠',
        title: 'Remote-Friendly',
        description: 'Work from where you are most productive. We embrace flexibility.'
    },
    {
        icon: '📈',
        title: 'Growth Budget',
        description: 'Annual budget for learning, conferences, and professional development.'
    },
    {
        icon: '🏥',
        title: 'Premium Health',
        description: 'Comprehensive health, dental, and vision coverage for you and your family.'
    },
    {
        icon: '🕶️',
        title: 'Work-Life Harmony',
        description: 'Generous time off and a culture that respects your personal time.'
    }
];

export const jobs = [
    {
        id: 1,
        title: 'Senior AI Engineer',
        location: 'Toronto, ON (Remote-friendly)',
        team: 'Engineering',
        type: 'Full-time',
        description: 'As a Senior AI Engineer at Spendigo, you will lead the development of our SmartCart AI optimization algorithms. You will work on massive datasets to help shoppers save money and find the best deals in real-time.',
        requirements: [
            'Master’s or PhD in Computer Science, AI, or a related field',
            '5+ years of experience with Machine Learning and Natural Language Processing',
            'Proficiency in Python, TensorFlow/PyTorch, and cloud infrastructure (AWS/GCP)',
            'Track record of deploying AI models at scale'
        ],
        responsibilities: [
            'Design and implement scalable machine learning models for price prediction',
            'Optimize search and recommendation systems for grocery data',
            'Collaborate with frontend engineers to integrate AI features into the shopper experience',
            'Mentor junior engineers and contribute to our engineering culture'
        ]
    },
    {
        id: 2,
        title: 'Marketing Intern Associate (SWPP)',
        location: 'Toronto, ON',
        team: 'Marketing',
        type: 'Internship',
        description: 'Join our marketing team as an intern and gain hands-on experience in digital marketing, social media strategy, and brand growth. This position is eligible for the Student Work Placement Program (SWPP).',
        requirements: [
            'Currently enrolled in a Canadian post-secondary institution',
            'Eligible for the Student Work Placement Program (SWPP)',
            'Strong understanding of digital marketing and social media trends',
            'Excellent written and verbal communication skills in English'
        ],
        responsibilities: [
            'Assist in managing social media channels and content calendars',
            'Conduct market research and competitor analysis',
            'Support the team in organizing promotional events and campaigns',
            'Analyze marketing data and provide insights for growth'
        ]
    },
    {
        id: 3,
        title: 'Marketing Intern Associate (SWPP)',
        location: 'Ottawa, ON',
        team: 'Marketing',
        type: 'Internship',
        description: 'Grow your marketing career with Spendigo in the heart of Ottawa. You will work on localized marketing campaigns and help us expand our presence in the capital region.',
        requirements: [
            'Currently enrolled in a Canadian post-secondary institution',
            'Eligible for the Student Work Placement Program (SWPP)',
            'Bilingual in English and French is a strong asset',
            'Analytical mindset with a passion for consumer technology'
        ],
        responsibilities: [
            'Support the execution of regional marketing strategies',
            'Participate in consumer outreach and feedback collection',
            'Manage bilingual social media content updates',
            'Assist in developing local partnership opportunities'
        ]
    },
    {
        id: 4,
        title: 'Marketing Intern Associate (SWPP)',
        location: 'Cornwall, ON',
        team: 'Marketing',
        type: 'Internship',
        description: 'Be our eyes and ears in Cornwall! This internship focuses on local market engagement and community growth in Eastern Ontario.',
        requirements: [
            'Currently enrolled in a Canadian post-secondary institution',
            'Eligible for the Student Work Placement Program (SWPP)',
            'Knowledge of local market trends in Eastern Ontario',
            'Ability to work independently and meet deadlines'
        ],
        responsibilities: [
            'Coordinate with local store partners for promotional material distribution',
            'Draft newsletters and community-focused marketing copy',
            'Monitor local social groups and engage with potential users',
            'Track campaign performance in the Cornwall region'
        ]
    },
    {
        id: 5,
        title: 'Frontend Developer (React)',
        location: 'Toronto, ON (Remote-friendly)',
        team: 'Product',
        type: 'Full-time',
        description: 'We are looking for a React expert who loves building premium, high-performance web applications. You will be responsible for the core shopper interface of Spendigo.',
        requirements: [
            '3+ years of professional experience with React and TypeScript',
            'Deep understanding of CSS-in-JS and modern UI libraries',
            'Experience with state management (Redux, Zustand, or similar)',
            'Eye for detail and passion for building premium user experiences'
        ],
        responsibilities: [
            'Develop and maintain high-quality UI components using our design system',
            'Optimize web performance and ensure seamless interactions',
            'Collaborate with designers to implement pixel-perfect layouts',
            'Participate in code reviews and advocate for frontend best practices'
        ]
    },
    {
        id: 6,
        title: 'Product Designer',
        location: 'Toronto, ON (Remote-friendly)',
        team: 'Design',
        type: 'Full-time',
        description: 'As a Product Designer, you will shape the visual and interactive identity of Spendigo. You will work closely with product and engineering to create intuitive experiences for millions of users.',
        requirements: [
            'Strong portfolio demonstrating experience in mobile and web product design',
            'Proficiency in Figma and advanced prototyping tools',
            'Experience conducting user research and usability testing',
            'Ability to translate complex AI features into intuitive interfaces'
        ],
        responsibilities: [
            'Lead the design process from concept to final handoff',
            'Create wireframes, mockups, and high-fidelity prototypes',
            'Conduct user interviews and synthesize feedback into design improvements',
            'Maintain and expand our global design system'
        ]
    }
];
