import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './ui/Button';
import Card from './ui/Card';

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-[50vh] place-items-center">
          <Card className="max-w-lg p-8 text-center">
            <AlertTriangle className="mx-auto text-danger" size={28} />
            <h1 className="mt-4 font-heading text-xl font-bold">This page ran into a problem</h1>
            <p className="mt-2 text-sm text-muted">{this.state.error.message || 'Please try again.'}</p>
            <Button className="mt-5" onClick={() => this.setState({ error: null })}>Try again</Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
