import { Component } from 'react';

interface Props {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

export default class ErrorBoundary extends Component<Props, { hasError: boolean }> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  render(): React.ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
