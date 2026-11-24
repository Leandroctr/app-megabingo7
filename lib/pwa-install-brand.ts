export type InstallBrand = {
  name: string;
  iconUrl?: string;
  installUrl?: string;
  themeColor: string;
  backgroundColor: string;
  actionBackground?: string;
  actionInsetShadow?: string;
  actionTextColor?: string;
  instructionsBackground?: string;
  stepBackground?: string;
  stepTileBackground?: string;
  stepTileShadow?: string;
};

export const installBrandByDomain: Readonly<Record<string, Partial<Omit<InstallBrand, "installUrl">>>> = {
  "pwa.app-megabingo7.com": {
    name: "MegaBingo7",
    iconUrl: "https://myivwdbnpbuooncehwds.supabase.co/storage/v1/object/public/app-assets/icon192/1782499027031-166a736d-d8b9-4503-9a86-f21876dd487a-512x512.png",
    themeColor: "#00b0fe",
    backgroundColor: "#f7fbff",
    actionTextColor: "#0b0d29",
    instructionsBackground: "#eef6fc",
  },
};
