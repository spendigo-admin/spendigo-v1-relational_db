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
