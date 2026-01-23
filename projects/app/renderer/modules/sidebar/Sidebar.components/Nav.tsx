import { FiActivity, FiBarChart2 } from "react-icons/fi";
import { GiCardRandom } from "react-icons/gi";
import { Link } from "~/renderer/components";

const Navigation = () => {
  return (
    <nav className="p-3">
      <ul className="menu menu-sm p-0 gap-1">
        <li>
          <Link
            to="/current-session"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <FiActivity size={20} />
            <span className="font-medium">Current Session</span>
          </Link>
        </li>
        <li>
          <Link
            to="/sessions"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <FiBarChart2 size={20} />
            <span className="font-medium">Sessions</span>
          </Link>
        </li>
        <li>
          <Link
            to="/statistics"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <FiBarChart2 size={20} />
            <span className="font-medium">Statistics</span>
          </Link>
        </li>
        <li>
          <Link
            to="/cards"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <GiCardRandom size={20} />
            <span className="font-medium">Cards</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navigation;
