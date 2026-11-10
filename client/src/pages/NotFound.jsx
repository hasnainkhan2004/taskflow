import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const NotFound = () => (
  <div className="grid min-h-screen place-items-center bg-cream p-5 ">
    <Card className="max-w-md p-9 text-center">
      <Compass className="mx-auto text-coral" size={32} />
      <p className="mt-5 text-xs font-bold uppercase tracking-widest text-muted">404</p>
      <h1 className="mt-2 font-heading text-2xl font-bold">We couldn’t find that page</h1>
      <p className="mt-2 text-sm leading-6 text-muted">It may have moved, or the address might be mistyped.</p>
      <Button as={Link} to="/dashboard" className="mt-6">Back to dashboard</Button>
    </Card>
  </div>
);

export default NotFound;
