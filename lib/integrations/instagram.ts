// Instagram / Social Account Tracker Provider
// TODO: connect Meta Graph API (requires Business account + linked Facebook Page)

export interface InstagramAccount {
  id: string;
  handle: string;
  name: string;
  category: string;
  followers: string;
  growth: string;
  engagement: string;
  avatarUrl: string;
  posts: string[];
}

export interface SocialOverviewStats {
  avgGrowth: string;
  avgEngagement: string;
  totalReach: string;
}

const MOCK_ACCOUNTS: InstagramAccount[] = [
  {
    id: "acc-1",
    handle: "@studio.arch",
    name: "Studio Architecture",
    category: "Design & Spatial Arts",
    followers: "142.5K",
    growth: "+12.4%",
    engagement: "4.8%",
    avatarUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=150&q=80",
    posts: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=400&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=400&q=80"
    ]
  },
  {
    id: "acc-2",
    handle: "@chef.lucas",
    name: "Lucas Vane",
    category: "Culinary & Gastronomy",
    followers: "89.2K",
    growth: "+8.7%",
    engagement: "6.2%",
    avatarUrl: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=150&q=80",
    posts: [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
      "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=400&q=80"
    ]
  }
];

export class UnifiedInstagramProvider {
  // TODO: connect Meta Graph API (requires Business account + linked Facebook Page)

  async getOverviewStats(): Promise<SocialOverviewStats> {
    return {
      avgGrowth: "+10.55%",
      avgEngagement: "5.5%",
      totalReach: "231.7K"
    };
  }

  async listAccounts(): Promise<InstagramAccount[]> {
    return MOCK_ACCOUNTS;
  }

  async trackAccount(handle: string): Promise<InstagramAccount> {
    const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
    const newAcc: InstagramAccount = {
      id: `acc-${Date.now()}`,
      handle: cleanHandle,
      name: cleanHandle.substring(1).toUpperCase(),
      category: "Personal Brand",
      followers: "1.2K",
      growth: "+2.1%",
      engagement: "3.4%",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
      posts: [
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=400&q=80",
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80"
      ]
    };
    MOCK_ACCOUNTS.push(newAcc);
    return newAcc;
  }
}

export const instagramProvider = new UnifiedInstagramProvider();
