import { FiActivity, FiBarChart2, FiTrendingUp } from "react-icons/fi";
import { GiCardRandom } from "react-icons/gi";
import { MdCompareArrows } from "react-icons/md";

import { Link } from "~/renderer/components";

const Navigation = () => {
  return (
    <nav className="p-3">
      <ul className="menu menu-sm p-0 gap-1">
        <li>
          <Link
            to="/"
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
        <li>
          <Link
            to="/profit-forecast"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <FiTrendingUp size={20} />
            <span className="font-medium">Profit Forecast</span>
          </Link>
        </li>
        <li>
          <Link
            to="/rarity-insights"
            className="[&.active]:bg-primary/10 [&.active]:text-base-content"
          >
            <MdCompareArrows size={20} />
            <span className="font-medium">Rarity Insights</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navigation;
