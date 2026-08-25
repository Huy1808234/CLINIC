"use client";

import React from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App } from "antd";
import viVN from "antd/locale/vi_VN";
import { antdTheme } from "@/theme/antd-theme";

export interface AntdProviderProps {
  children: React.ReactNode;
}

export const AntdProvider: React.FC<AntdProviderProps> = ({ children }) => {
  return (
    <AntdRegistry>
      <ConfigProvider theme={antdTheme} locale={viVN}>
        <App className="min-h-full flex flex-col flex-1">
          {children}
        </App>
      </ConfigProvider>
    </AntdRegistry>
  );
};
